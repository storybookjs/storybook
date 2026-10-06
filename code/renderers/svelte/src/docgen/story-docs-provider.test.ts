// @vitest-environment node
import type {
  DocgenProviderDescriptor,
  IndexEntry,
  Options,
  StoryDocsPayload,
} from 'storybook/internal/types';

import { describe, expect, it, vi } from 'vitest';

import { experimental_docgenProvider } from './preset.ts';
import { buildStoryDocsPayload } from './story-docs/build-story-docs.ts';
import { experimental_storyDocsProvider } from './story-docs-provider.ts';

vi.mock('./story-docs/build-story-docs.ts', { spy: true });

const DOWNSTREAM: StoryDocsPayload = {
  id: 'button',
  name: 'Button',
  path: './Button.stories.svelte',
  import: "import Button from './Button.svelte';",
  stories: {},
};

const optionsWith = (apply: (key: string) => Promise<unknown>): Options =>
  ({ presets: { apply } }) as unknown as Options;

const SVELTE_DESCRIPTORS = await experimental_docgenProvider(
  [],
  optionsWith(async () => ({ experimentalDocgenServer: true }))
);

const svelteWorkerOptions = optionsWith(async () => SVELTE_DESCRIPTORS);

const entryFor = (importPath: string): IndexEntry => ({
  id: 'button--primary',
  name: 'Primary',
  title: 'Button',
  type: 'story',
  subtype: 'story',
  importPath,
});

describe('experimental_storyDocsProvider', () => {
  it('passes through when the Svelte docgen worker is not registered', async () => {
    const next = vi.fn(async () => DOWNSTREAM);
    const others: DocgenProviderDescriptor[] = [{ moduleSpecifier: '/addon/docgen-worker.js' }];

    await expect(
      experimental_storyDocsProvider(
        next,
        optionsWith(async () => others)
      )
    ).resolves.toBe(next);
  });

  it.each([
    { importPath: './Button.stories.svelte', builds: true },
    { importPath: './Button.svelte', builds: false },
    { importPath: './Button.stories.ts', builds: false },
  ])('$importPath is built: $builds', async ({ importPath, builds }) => {
    const provider = await experimental_storyDocsProvider(
      async () => DOWNSTREAM,
      svelteWorkerOptions
    );

    await expect(provider({ entry: entryFor(importPath) })).resolves.toBe(DOWNSTREAM);
    expect(buildStoryDocsPayload).toHaveBeenCalledTimes(builds ? 1 : 0);
  });

  it('merges its payload over downstream', async () => {
    vi.mocked(buildStoryDocsPayload).mockResolvedValueOnce({
      id: 'button',
      name: 'Button',
      path: './Button.stories.svelte',
      stories: {
        'button--primary': { id: 'button--primary', name: 'Primary', snippet: '<Button />' },
      },
    });
    const provider = await experimental_storyDocsProvider(
      async () => DOWNSTREAM,
      svelteWorkerOptions
    );

    await expect(provider({ entry: entryFor('./Button.stories.svelte') })).resolves.toEqual({
      id: 'button',
      name: 'Button',
      path: './Button.stories.svelte',
      import: "import Button from './Button.svelte';",
      stories: {
        'button--primary': { id: 'button--primary', name: 'Primary', snippet: '<Button />' },
      },
    });
  });
});
