import { beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';

import type { Options } from '../../../../types/modules/core-common.ts';
import type { IndexEntry } from '../../../../types/modules/indexer.ts';
import { createWorkerGatedStoryDocsProvider } from './provider.ts';
import type { StoryDocsPayload, StoryDocsProviderInput } from './types.ts';

vi.mock('storybook/internal/node-logger', { spy: true });

const WORKER = '/renderer/dist/docgen-worker.js';

const DOWNSTREAM: StoryDocsPayload = {
  id: 'button',
  name: 'Button',
  path: './Button.stories.ts',
  import: "import { Button } from './Button';",
  stories: {},
};

const OURS: StoryDocsPayload = {
  id: 'button',
  name: 'Button',
  path: './Button.stories.ts',
  stories: { 'button--primary': { id: 'button--primary', name: 'Primary', snippet: '<x-button>' } },
};

const entryFor = (importPath: string): IndexEntry => ({
  id: 'button--primary',
  name: 'Primary',
  title: 'Button',
  type: 'story',
  subtype: 'story',
  importPath,
});

const optionsWith = (workers: string[]): Options =>
  ({
    presets: {
      apply: async <T>(key: string, fallback: T): Promise<T> =>
        key === 'experimental_docgenProvider'
          ? (workers.map((moduleSpecifier) => ({ moduleSpecifier })) as T)
          : fallback,
    },
  }) as Options;

beforeEach(() => {
  vi.mocked(logger.debug).mockImplementation(() => {});
});

describe('createWorkerGatedStoryDocsProvider', () => {
  it('returns the next provider unchanged when its docgen worker is not registered', async () => {
    const next = vi.fn(async () => DOWNSTREAM);
    const preset = createWorkerGatedStoryDocsProvider({
      label: 'Test',
      docgenWorker: WORKER,
      build: async () => OURS,
    });

    await expect(preset(next, optionsWith(['/other/docgen-worker.js']))).resolves.toBe(next);
  });

  it.each<{
    name: string;
    importPath: string;
    storyFileTest?: RegExp;
    build: (input: StoryDocsProviderInput) => Promise<StoryDocsPayload | undefined>;
    expected: StoryDocsPayload;
  }>([
    {
      name: 'merges its payload over the next provider',
      importPath: './Button.stories.ts',
      build: async () => OURS,
      expected: { ...OURS, import: DOWNSTREAM.import },
    },
    {
      name: 'hands the story on when the build returns nothing',
      importPath: './Button.stories.ts',
      build: async () => undefined,
      expected: DOWNSTREAM,
    },
    {
      name: 'hands the story on when the file is not a CSF story file',
      importPath: './Button.mdx',
      build: async () => OURS,
      expected: DOWNSTREAM,
    },
    {
      name: 'uses a renderer-specific story file pattern',
      importPath: './Button.stories.svelte',
      storyFileTest: /\.stories\.svelte$/,
      build: async () => OURS,
      expected: { ...OURS, import: DOWNSTREAM.import },
    },
  ])('$name', async ({ importPath, storyFileTest, build, expected }) => {
    const preset = createWorkerGatedStoryDocsProvider({
      label: 'Test',
      docgenWorker: WORKER,
      storyFileTest,
      build,
    });
    const provider = await preset(async () => DOWNSTREAM, optionsWith([WORKER]));

    await expect(provider({ entry: entryFor(importPath) })).resolves.toEqual(expected);
  });

  it('logs a story file it cannot read and hands it to the next provider', async () => {
    const preset = createWorkerGatedStoryDocsProvider({
      label: 'Test',
      docgenWorker: WORKER,
      build: async () => {
        throw new Error('parse failed');
      },
    });
    const provider = await preset(async () => DOWNSTREAM, optionsWith([WORKER]));

    await expect(provider({ entry: entryFor('./Button.stories.ts') })).resolves.toBe(DOWNSTREAM);
    expect(logger.debug).toHaveBeenCalledWith(
      'Test story snippets are unavailable for ./Button.stories.ts: parse failed'
    );
  });
});
