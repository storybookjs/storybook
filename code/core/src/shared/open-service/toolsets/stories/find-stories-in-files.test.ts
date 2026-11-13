import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';

import type { StoryIndex } from 'storybook/internal/types';

import { vol } from 'memfs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { findStoriesInFiles } from './find-stories-in-files.ts';
import type { ModuleGraphAccess, ModuleGraphStoryHit } from './resolve-component-stories.ts';

vi.mock('node:fs', { spy: true });

const WORKING_DIR = path.resolve('/repo');
const BUTTON = path.join(WORKING_DIR, 'src/Button.tsx');
const BUTTON_STORIES = path.join(WORKING_DIR, 'src/Button.stories.tsx');
const UNUSED = path.join(WORKING_DIR, 'src/unused.ts');

const asGraphPath = (filePath: string) => path.normalize(filePath).replaceAll('\\', '/');

function story(id: string, importPath: string, subtype: 'story' | 'test' = 'story') {
  return {
    type: 'story' as const,
    subtype,
    id,
    name: id,
    title: id.split('--')[0],
    importPath,
    tags: ['story'],
  };
}

const index = {
  v: 5,
  entries: {
    'button--primary': story('button--primary', './src/Button.stories.tsx'),
    'button--primary:renders': story('button--primary:renders', './src/Button.stories.tsx', 'test'),
    'button--docs': {
      type: 'docs',
      id: 'button--docs',
      name: 'Docs',
      title: 'Button',
      importPath: './src/Button.stories.tsx',
      storiesImports: [],
      tags: ['autodocs'],
    },
    'header--default': story('header--default', './src/Header.stories.tsx'),
  },
} as unknown as StoryIndex;

const storiesForFiles = vi.fn();

/** A ready module graph whose reverse index answers `hits` for the Button component. */
function readyGraph(hits: ModuleGraphStoryHit[]): ModuleGraphAccess {
  storiesForFiles.mockImplementation(async ({ files }: { files: string[] }) =>
    files.map((file) => (file === asGraphPath(BUTTON) ? hits : []))
  );
  return {
    queries: {
      status: { loaded: async () => ({ value: 'ready' }) },
      storiesForFiles: { loaded: storiesForFiles },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vol.reset();
  vol.fromNestedJSON({ [BUTTON]: '', [BUTTON_STORIES]: '', [UNUSED]: '' });
  vi.mocked(existsSync).mockImplementation((filePath) => vol.existsSync(filePath));
  vi.mocked(realpathSync.native).mockImplementation((filePath) =>
    String(vol.realpathSync(filePath))
  );
});

describe('findStoriesInFiles', () => {
  it('selects the stories of a story file, tests included, without the module graph', async () => {
    const getModuleGraph = vi.fn();

    const results = await findStoriesInFiles({
      files: ['src/Button.stories.tsx', BUTTON_STORIES],
      index,
      getModuleGraph,
      workingDir: WORKING_DIR,
    });

    const selected = {
      kind: 'story-file',
      storyIds: ['button--primary', 'button--primary:renders'],
      storyFiles: ['./src/Button.stories.tsx'],
    };
    expect(results).toEqual([
      { file: 'src/Button.stories.tsx', ...selected },
      { file: BUTTON_STORIES, ...selected },
    ]);
    expect(getModuleGraph).not.toHaveBeenCalled();
  });

  it('selects every story that depends on a component file, across story files', async () => {
    const results = await findStoriesInFiles({
      files: [BUTTON],
      index,
      getModuleGraph: () =>
        readyGraph([
          { storyFile: './src/Button.stories.tsx', depth: 1 },
          { storyFile: './src/Header.stories.tsx', depth: 7 },
        ]),
      workingDir: WORKING_DIR,
    });

    expect(results).toEqual([
      {
        file: BUTTON,
        kind: 'component',
        storyIds: ['button--primary', 'button--primary:renders', 'header--default'],
        storyFiles: ['./src/Button.stories.tsx', './src/Header.stories.tsx'],
      },
    ]);
  });

  it('says a missing file does not exist', async () => {
    const results = await findStoriesInFiles({
      files: ['src/Nope.stories.tsx'],
      index,
      getModuleGraph: () => undefined,
      workingDir: WORKING_DIR,
    });

    expect(results).toEqual([
      { file: 'src/Nope.stories.tsx', errorMessage: 'No file found at src/Nope.stories.tsx.' },
    ]);
  });

  it('says a file that no story imports has no stories', async () => {
    const [result] = await findStoriesInFiles({
      files: [UNUSED],
      index,
      getModuleGraph: () => readyGraph([]),
      workingDir: WORKING_DIR,
    });

    expect(result).toEqual({
      file: UNUSED,
      errorMessage: expect.stringContaining(
        'No stories found for src/unused.ts: it is not a story file in the Storybook index, and no story imports it.'
      ),
    });
  });

  it('reports a missing module graph instead of claiming a component has no stories', async () => {
    const [result] = await findStoriesInFiles({
      files: [BUTTON],
      index,
      getModuleGraph: () => undefined,
      workingDir: WORKING_DIR,
    });

    expect(result).toEqual({
      file: BUTTON,
      errorMessage: expect.stringContaining(
        "src/Button.tsx is not a story file, and finding the stories that depend on it needs Storybook's module graph:"
      ),
    });
  });
});
