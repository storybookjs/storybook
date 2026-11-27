import { describe, expect, it } from 'vitest';

import type { RenderContext, StoryContext } from 'storybook/internal/types';

import Button from './__test__/Button.svelte';
import { renderToCanvas } from './render.ts';
import type { SvelteRenderer } from './types.ts';

function recordingContext(overrides: Partial<RenderContext<SvelteRenderer>>) {
  const calls: unknown[][] = [];
  const context = {
    id: 'story',
    title: 'Title',
    name: 'Story',
    storyContext: { id: 'story' } as StoryContext<SvelteRenderer>,
    storyFn: () => ({ Component: Button, props: { label: 'Click me' } }),
    forceRemount: true,
    showMain: () => calls.push(['showMain']),
    showError: ({ title }) => calls.push(['showError', title]),
    showException: (error) => calls.push(['showException', error]),
    ...overrides,
  } as RenderContext<SvelteRenderer>;
  return { calls, context };
}

describe('renderToCanvas', () => {
  it('ends on showError when the story returns no component', async () => {
    const { calls, context } = recordingContext({ storyFn: () => ({}) });

    const teardown = await renderToCanvas(context, document.createElement('div'));
    teardown();

    expect(calls.at(-1)).toEqual([
      'showError',
      'Expecting a Svelte component from the story: "Story" of "Title".',
    ]);
  });

  it('rejects when the story function throws on an args update', async () => {
    const canvasElement = document.createElement('div');
    const error = new Error('Story did something wrong');
    const teardown = await renderToCanvas(recordingContext({}).context, canvasElement);
    const { context } = recordingContext({
      forceRemount: false,
      storyFn: () => {
        throw error;
      },
    });

    await expect(renderToCanvas(context, canvasElement)).rejects.toBe(error);
    teardown();
  });

  it('renders the next args update after one that threw', async () => {
    const canvasElement = document.createElement('div');
    const teardown = await renderToCanvas(recordingContext({}).context, canvasElement);
    const throwing = recordingContext({
      forceRemount: false,
      storyFn: () => {
        throw new Error('Story did something wrong');
      },
    });
    await expect(renderToCanvas(throwing.context, canvasElement)).rejects.toThrow();
    const { calls, context } = recordingContext({
      forceRemount: false,
      storyFn: () => ({ Component: Button, props: { label: 'Updated' } }),
    });

    await renderToCanvas(context, canvasElement);

    expect(canvasElement.textContent?.trim()).toBe('Updated');
    expect(calls).toEqual([['showMain']]);
    teardown();
  });
});
