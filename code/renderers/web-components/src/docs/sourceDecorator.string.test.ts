import { describe, expect, it, vi } from 'vitest';

import { html } from 'lit';
import { emitTransformCode } from 'storybook/preview-api';

import { sourceDecorator } from './sourceDecorator';

vi.mock('storybook/preview-api', () => ({
  useEffect: vi.fn((cb) => setTimeout(() => cb(), 0)),
  emitTransformCode: vi.fn(),
}));

const tick = () => new Promise((r) => setTimeout(r, 0));

const makeContext = () => ({
  id: 'header--string-template',
  args: { active: 'playground', debug: false },
  unmappedArgs: { active: 'playground', debug: false },
  parameters: { docs: { source: {} }, __isArgsStory: true },
  originalStoryFn: vi.fn(),
});

describe('sourceDecorator – raw HTML string stories', () => {
  it('emits the string verbatim, without HTML-escaping the tags', async () => {
    const storyFn = () =>
      `<deepgram-header active="playground" debug="false"></deepgram-header>` as any;

    sourceDecorator(storyFn, makeContext() as any);
    await tick();

    expect(emitTransformCode).toHaveBeenCalledWith(
      '<deepgram-header active="playground" debug="false"></deepgram-header>',
      expect.anything()
    );
  });

  it('still serializes lit `html` templates correctly (no regression)', async () => {
    const storyFn = () =>
      html`
        <deepgram-header active="playground" debug="false"></deepgram-header>
      ` as any;

    sourceDecorator(storyFn, makeContext() as any);
    await tick();

    const emitted = vi.mocked(emitTransformCode).mock.calls.at(-1)?.[0];
    expect(emitted).toContain('<deepgram-header active="playground" debug="false">');
    expect(emitted).not.toContain('&lt;');
  });
});
