import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';

import type { StoryIndex } from 'storybook/internal/types';

import { vol } from 'memfs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ModuleGraphAccess, ModuleGraphStoryHit } from './resolve-component-stories.ts';
import { filterStoryFiles, findChangedStories } from './select-stories.ts';

vi.mock('node:fs', { spy: true });

const ROOT = path.resolve('/repo');
const at = (file: string) => path.join(ROOT, file).replaceAll('\\', '/');

function story(id: string, importPath: string, subtype: 'story' | 'test' = 'story') {
  return { type: 'story', subtype, id, name: id, title: id, importPath, tags: [] };
}

const index = {
  v: 5,
  entries: {
    'button--primary': story('button--primary', './src/Button.stories.tsx'),
    'button--primary:renders': story('button--primary:renders', './src/Button.stories.tsx', 'test'),
    'header--default': story('header--default', './src/header/Header.stories.tsx'),
    'page--default': story('page--default', './src/Page.stories.tsx'),
    'button--docs': {
      type: 'docs',
      id: 'button--docs',
      name: 'Docs',
      title: 'Button',
      importPath: './src/Button.stories.tsx',
      storiesImports: [],
      tags: [],
    },
  },
} as unknown as StoryIndex;

beforeEach(() => {
  vi.clearAllMocks();
  vol.reset();
  vol.fromNestedJSON({
    [at('src/Button.tsx')]: '',
    [at('src/theme.ts')]: '',
    [at('README.md')]: '',
  });
  vi.mocked(existsSync).mockImplementation((file) => vol.existsSync(file));
  vi.mocked(realpathSync.native).mockImplementation(((file: string) => {
    if (!vol.existsSync(file)) {
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    }
    return String(vol.realpathSync(file));
  }) as never);
});

describe('filterStoryFiles', () => {
  const filter = (filters: string[], cwd = ROOT) =>
    filterStoryFiles({ index, filters, cwd, workingDir: ROOT });

  it('matches a case-insensitive substring of the path relative to the current directory', () => {
    expect(filter(['button'])).toEqual({
      storyFiles: ['./src/Button.stories.tsx'],
      storyIds: ['button--primary', 'button--primary:renders'],
    });
    expect(filter(['src/Header']).storyFiles).toEqual(['./src/header/Header.stories.tsx']);
  });

  it('matches an absolute file or directory as a path prefix', () => {
    expect(filter([at('src/Button.stories.tsx')]).storyFiles).toEqual(['./src/Button.stories.tsx']);
    expect(filter([at('src/header')]).storyFiles).toEqual(['./src/header/Header.stories.tsx']);
  });

  it('matches relative to the current directory, from a subdirectory too', () => {
    expect(filter(['Header.stories'], at('src/header')).storyFiles).toEqual([
      './src/header/Header.stories.tsx',
    ]);
  });

  it('unions several filters and ignores one that matches nothing', () => {
    expect(filter(['Button', 'Page', 'nothing-here']).storyFiles).toEqual([
      './src/Button.stories.tsx',
      './src/Page.stories.tsx',
    ]);
  });

  it('matches no story file for a component file', () => {
    expect(filter(['src/Button.tsx'])).toEqual({ storyFiles: [], storyIds: [] });
  });
});

describe('findChangedStories', () => {
  const storiesForFiles = vi.fn();
  const loadedByPreview = vi.fn();

  function graph(hits: Record<string, ModuleGraphStoryHit[]>, preview: string[] = []) {
    storiesForFiles.mockImplementation(async ({ files }: { files: string[] }) =>
      files.map((file) => hits[file] ?? [])
    );
    loadedByPreview.mockImplementation(async ({ files }: { files: string[] }) =>
      files.map((file) => preview.includes(file))
    );
    return (): ModuleGraphAccess => ({
      queries: {
        status: { loaded: async () => ({ value: 'ready' }) },
        storiesForFiles: { loaded: storiesForFiles },
        loadedByPreview: { loaded: loadedByPreview },
      },
    });
  }

  const find = (
    changedFiles: string[],
    getModuleGraph: () => ModuleGraphAccess | undefined = graph({})
  ) => findChangedStories({ index, changedFiles, getModuleGraph, workingDir: ROOT });

  it('selects the stories of a changed story file without asking the graph', async () => {
    const getModuleGraph = vi.fn();

    expect(await find([at('src/Button.stories.tsx')], getModuleGraph)).toEqual({
      kind: 'stories',
      storyFiles: ['./src/Button.stories.tsx'],
      storyIds: ['button--primary', 'button--primary:renders'],
    });
    expect(getModuleGraph).not.toHaveBeenCalled();
  });

  it('selects the stories that depend on another changed file, at any depth', async () => {
    const result = await find(
      [at('src/Button.tsx')],
      graph({
        [at('src/Button.tsx')]: [
          { storyFile: './src/Button.stories.tsx', depth: 1 },
          { storyFile: './src/Page.stories.tsx', depth: 9 },
        ],
      })
    );

    expect(result).toEqual({
      kind: 'stories',
      storyFiles: ['./src/Button.stories.tsx', './src/Page.stories.tsx'],
      storyIds: ['button--primary', 'button--primary:renders', 'page--default'],
    });
  });

  it('selects every story for a file the preview loads', async () => {
    expect(await find([at('src/theme.ts')], graph({}, [at('src/theme.ts')]))).toEqual({
      kind: 'every-story',
      trigger: at('src/theme.ts'),
    });
  });

  it("selects every story for Vitest's rerun triggers, without the graph", async () => {
    const getModuleGraph = vi.fn();

    expect(await find([at('vite.config.ts')], getModuleGraph)).toEqual({
      kind: 'every-story',
      trigger: at('vite.config.ts'),
    });
    expect(await find([at('packages/ui/package.json')], getModuleGraph)).toMatchObject({
      kind: 'every-story',
    });
    expect(getModuleGraph).not.toHaveBeenCalled();
  });

  it('selects nothing for deleted files and files no story imports', async () => {
    expect(await find([at('src/Deleted.tsx'), at('README.md')])).toEqual({
      kind: 'stories',
      storyFiles: [],
      storyIds: [],
    });
  });

  it('reports a missing module graph instead of selecting nothing', async () => {
    expect(await find([at('src/Button.tsx')], () => undefined)).toMatchObject({
      kind: 'unavailable',
    });
  });
});
