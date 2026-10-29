// @vitest-environment node
import type {
  DocgenProviderDescriptor,
  IndexEntry,
  Options,
  StoryDocsPayload,
  StoryDocsProvider,
} from '@storybook/core/internal/types';

import { describe, expect, it, vi } from 'vitest';

import {
  createTestInstanceContext,
  runInTestInstance,
} from '../../../../core/src/shared/instance-context.test-helpers.ts';
import { getDocgenProvider } from './provider.ts';
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

const SVELTE_DESCRIPTORS = [getDocgenProvider()];

/** Resolve the provider in an instance whose plugins registered `descriptors`. */
const providerWith = (
  descriptors: DocgenProviderDescriptor[],
  next: StoryDocsProvider
): Promise<StoryDocsProvider> =>
  runInTestInstance(() => experimental_storyDocsProvider(next, {} as Options), {
    ...createTestInstanceContext(),
    storybook: { callHook: async () => descriptors } as never,
  });

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

    await expect(providerWith(others, next)).resolves.toBe(next);
  });

  it.each([
    { importPath: './Button.stories.svelte', builds: true },
    { importPath: './Button.svelte', builds: false },
    { importPath: './Button.stories.ts', builds: false },
  ])('$importPath is built: $builds', async ({ importPath, builds }) => {
    const provider = await providerWith(SVELTE_DESCRIPTORS, async () => DOWNSTREAM);

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
    const provider = await providerWith(SVELTE_DESCRIPTORS, async () => DOWNSTREAM);

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
