import { existsSync, realpathSync, statSync } from 'node:fs';
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
  vi.mocked(statSync).mockImplementation(((filePath: string) => vol.statSync(filePath)) as never);
  vi.mocked(realpathSync.native).mockImplementation((filePath) =>
    String(vol.realpathSync(filePath))
  );
});

describe('findStoriesInFiles', () => {
  it('selects the stories of a story file, tests included, without the module graph', async () => {
    const getModuleGraph = vi.fn();

    const results = await findStoriesInFiles({
      files: ['src/Button.stories.tsx'],
      index,
      getModuleGraph,
      workingDir: WORKING_DIR,
    });

    const selected = {
      kind: 'story-file',
      storyIds: ['button--primary', 'button--primary:renders'],
      storyFiles: ['./src/Button.stories.tsx'],
    };
    expect(results).toEqual([{ file: 'src/Button.stories.tsx', ...selected }]);
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
      {
        file: 'src/Nope.stories.tsx',
        errorMessage: `No file found at src/Nope.stories.tsx (relative paths resolve against ${WORKING_DIR}). If you deleted it, leave it out.`,
      },
    ]);
  });

  it('gives a file passed twice, in any spelling, one result', async () => {
    const results = await findStoriesInFiles({
      files: [BUTTON, './src/Button.tsx', 'src/Button.stories.tsx', BUTTON_STORIES],
      index,
      getModuleGraph: () => readyGraph([{ storyFile: './src/Header.stories.tsx', depth: 2 }]),
      workingDir: WORKING_DIR,
    });

    expect(results).toEqual([
      expect.objectContaining({ file: BUTTON, kind: 'component', storyIds: ['header--default'] }),
      expect.objectContaining({ file: 'src/Button.stories.tsx', kind: 'story-file' }),
    ]);
  });

  it('keeps component results with their own file after a repeated one', async () => {
    const HEADER = path.join(WORKING_DIR, 'src/Header.tsx');
    vol.fromNestedJSON({ [HEADER]: '' });
    storiesForFiles.mockImplementation(async ({ files }: { files: string[] }) =>
      files.map((file) =>
        file === asGraphPath(BUTTON)
          ? [{ storyFile: './src/Button.stories.tsx', depth: 1 }]
          : file === asGraphPath(HEADER)
            ? [{ storyFile: './src/Header.stories.tsx', depth: 1 }]
            : []
      )
    );
    const graph: ModuleGraphAccess = {
      queries: {
        status: { loaded: async () => ({ value: 'ready' }) },
        storiesForFiles: { loaded: storiesForFiles },
      },
    };

    const results = await findStoriesInFiles({
      files: [BUTTON, BUTTON, HEADER],
      index,
      getModuleGraph: () => graph,
      workingDir: WORKING_DIR,
    });

    expect(results).toEqual([
      expect.objectContaining({ file: BUTTON, storyFiles: ['./src/Button.stories.tsx'] }),
      expect.objectContaining({ file: HEADER, storyIds: ['header--default'] }),
    ]);
  });

  it('asks for files instead of a directory', async () => {
    const [result] = await findStoriesInFiles({
      files: ['src'],
      index,
      getModuleGraph: () => readyGraph([]),
      workingDir: WORKING_DIR,
    });

    expect(result).toEqual({
      file: 'src',
      errorMessage: 'src is a directory: pass the story files or component files in it.',
    });
  });

  it('finds a story file through a symlinked path', async () => {
    const LINK = path.join(WORKING_DIR, 'link.stories.tsx');
    vol.symlinkSync(BUTTON_STORIES, LINK);

    const [result] = await findStoriesInFiles({
      files: [LINK],
      index,
      getModuleGraph: () => undefined,
      workingDir: WORKING_DIR,
    });

    expect(result).toEqual(expect.objectContaining({ kind: 'story-file' }));
  });

  it('reports a file that no story depends on as unrelated, not as an error', async () => {
    const [result] = await findStoriesInFiles({
      files: [UNUSED],
      index,
      getModuleGraph: () => readyGraph([]),
      workingDir: WORKING_DIR,
    });

    expect(result).toEqual({ file: UNUSED, kind: 'unrelated', storyIds: [], storyFiles: [] });
  });

  it('selects every story for a file the preview loads, even when stories import it too', async () => {
    const loadedByPreview = vi.fn(async ({ files }: { files: string[] }) =>
      files.map((file) => file === asGraphPath(BUTTON))
    );
    const graph = readyGraph([{ storyFile: './src/Button.stories.tsx', depth: 1 }]);

    const results = await findStoriesInFiles({
      files: [BUTTON, UNUSED],
      index,
      getModuleGraph: () => ({
        queries: { ...graph.queries, loadedByPreview: { loaded: loadedByPreview } },
      }),
      workingDir: WORKING_DIR,
    });

    expect(results).toEqual([
      { file: BUTTON, kind: 'preview', storyIds: [], storyFiles: [] },
      { file: UNUSED, kind: 'unrelated', storyIds: [], storyFiles: [] },
    ]);
    // Asked with the given and the real path of each file.
    expect(loadedByPreview).toHaveBeenCalledWith({
      files: [BUTTON, UNUSED, asGraphPath(BUTTON), asGraphPath(UNUSED)],
    });
  });

  it('falls back to the import graph when the preview check fails', async () => {
    const graph = readyGraph([{ storyFile: './src/Button.stories.tsx', depth: 1 }]);

    const [result] = await findStoriesInFiles({
      files: [BUTTON],
      index,
      getModuleGraph: () => ({
        queries: {
          ...graph.queries,
          loadedByPreview: {
            loaded: async () => {
              throw new Error('Unknown command `loadedByPreview`');
            },
          },
        },
      }),
      workingDir: WORKING_DIR,
    });

    expect(result).toEqual(expect.objectContaining({ file: BUTTON, kind: 'component' }));
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
