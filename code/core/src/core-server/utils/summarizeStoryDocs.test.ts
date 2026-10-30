import { readFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocsIndexEntry, StoryIndex, StoryIndexEntry } from 'storybook/internal/types';

import { vol } from 'memfs';
import { join, resolve } from 'pathe';

import { summarizeStoryDocs } from './summarizeStoryDocs.ts';

vi.mock('node:fs/promises', { spy: true });

const outputDir = resolve('/output');

const story = (id: string, overrides: Partial<StoryIndexEntry> = {}): StoryIndexEntry => {
  const [componentId, name] = id.split('--');
  return {
    id,
    title: componentId,
    name,
    importPath: `./src/${componentId}.stories.tsx`,
    type: 'story',
    subtype: 'story',
    ...overrides,
  };
};

const docs = (id: string): DocsIndexEntry => ({
  id,
  title: id.split('--')[0],
  name: 'Docs',
  importPath: './src/button.mdx',
  storiesImports: [],
  type: 'docs',
});

const toIndex = (entries: (StoryIndexEntry | DocsIndexEntry)[]): StoryIndex => ({
  v: 5,
  entries: Object.fromEntries(entries.map((entry) => [entry.id, entry])),
});

const writeStoryDocs = (components: Record<string, unknown>) =>
  vol.fromJSON(
    Object.fromEntries(
      Object.entries(components).map(([id, payload]) => [
        join(outputDir, 'services/core/story-docs', `${id}.json`),
        JSON.stringify({ components: { [id]: payload } }),
      ])
    )
  );

describe('summarizeStoryDocs', () => {
  beforeEach(async () => {
    vol.reset();
    const memfs = await vi.importActual<typeof import('memfs')>('memfs');
    vi.mocked(readFile).mockImplementation(
      memfs.fs.promises.readFile as unknown as typeof import('node:fs/promises').readFile
    );
  });

  it('counts each story once by its snippet outcome', async () => {
    writeStoryDocs({
      button: {
        id: 'button',
        name: 'Button',
        path: './src/button.stories.tsx',
        stories: {
          'button--complete': { id: 'button--complete', name: 'Complete', snippet: '<Button />' },
          'button--partial': {
            id: 'button--partial',
            name: 'Partial',
            snippet: '<Button onClick={onClick} />',
            warning: 'onClick',
          },
          'button--dynamic': { id: 'button--dynamic', name: 'Dynamic', warning: 'render' },
          'button--failed': {
            id: 'button--failed',
            name: 'Failed',
            error: { name: 'Error', message: 'boom' },
          },
          'button--from-other-file': {
            id: 'button--from-other-file',
            name: 'From other file',
            snippet: '<Button />',
          },
        },
      },
      card: {
        id: 'card',
        name: 'Card',
        path: './src/card.stories.tsx',
        stories: {},
        error: { name: 'Error', message: 'boom' },
      },
    });

    const index = toIndex([
      story('button--complete'),
      story('button--partial'),
      story('button--dynamic'),
      story('button--failed'),
      story('button--unlisted'),
      story('button--from-other-file', { importPath: './src/button.more.stories.tsx' }),
      story('card--first'),
      story('card--second'),
      story('avatar--without-file'),
    ]);

    expect(await summarizeStoryDocs(index, outputDir)).toEqual({
      storyCount: 9,
      errorCount: 5,
      noSnippetCount: 1,
      warningCount: 1,
    });
  });

  it('leaves out docs entries, tests, and the example stories of init', async () => {
    writeStoryDocs({
      button: {
        id: 'button',
        name: 'Button',
        path: './src/button.stories.tsx',
        stories: { 'button--primary': { id: 'button--primary', name: 'Primary', snippet: 'x' } },
      },
    });

    const index = toIndex([
      story('button--primary'),
      story('button--primary:test', { subtype: 'test', parent: 'button--primary' }),
      docs('button--docs'),
      story('example-button--primary'),
      story('example-header--logged-in'),
    ]);

    expect(await summarizeStoryDocs(index, outputDir)).toEqual({
      storyCount: 1,
      errorCount: 0,
      noSnippetCount: 0,
      warningCount: 0,
    });
  });
});
