import { existsSync } from 'node:fs';

import type { StoryIndex } from 'storybook/internal/types';

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as v from 'valibot';
import { vol } from 'memfs';

import type { ToolsetCtx } from '../../toolset-definition.ts';
import { CHANGE_DETECTION_STATUS_TYPE_ID } from '../../../status-store/index.ts';
import { createStoriesToolset } from './definition.ts';

vi.mock('node:fs', { spy: true });

const index = {
  v: 5,
  entries: {
    'button--primary': {
      type: 'story',
      subtype: 'story',
      id: 'button--primary',
      name: 'Primary',
      title: 'Button',
      importPath: './src/Button.stories.tsx',
      tags: ['story'],
    },
  },
} as StoryIndex;

const repoRoot = '/repo';
const storybookWorkingDir = '/repo/packages/ui';
const componentPath = `${storybookWorkingDir}/src/Button.tsx`;
const themePath = `${storybookWorkingDir}/src/theme.ts`;
const getIndex = vi.fn();
const getChangedFiles = vi.fn();
const getRepoRoot = vi.fn();
const getStatuses = vi.fn();
const graphStatus = vi.fn();
const storiesForFiles = vi.fn();
const cwd = vi.spyOn(process, 'cwd');
const moduleGraph = {
  queries: {
    status: { loaded: graphStatus },
    storiesForFiles: { loaded: storiesForFiles },
  },
};

const storyIndex = { getIndex };
const git = { getChangedFiles, getRepoRoot };
const changeStatuses = { getAll: getStatuses };
let statusesFixture: Record<string, Record<string, unknown>>;
let graphMatchesByFile: Map<string, Array<{ storyFile: string; depth: number }>>;
let ctx: ToolsetCtx;

function createToolset() {
  return createStoriesToolset({
    storyIndex,
    git,
    changeStatuses,
  });
}

beforeEach(async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');

  vi.clearAllMocks();
  vol.reset();
  vol.fromNestedJSON({ [componentPath]: '' });
  vi.mocked(existsSync).mockImplementation(memfs.fs.existsSync as typeof existsSync);
  cwd.mockReturnValue(storybookWorkingDir);
  statusesFixture = {};
  graphMatchesByFile = new Map([
    [componentPath, [{ storyFile: './src/Button.stories.tsx', depth: 1 }]],
  ]);
  ctx = {
    consumer: 'cli',
    origin: 'http://localhost:6006',
    format: 'markdown',
    getService: vi.fn(() => moduleGraph) as ToolsetCtx['getService'],
  };
  getIndex.mockResolvedValue(index);
  getChangedFiles.mockResolvedValue({
    changed: new Set(['packages/ui/src/Button.tsx']),
    new: new Set(['packages/ui/src/theme.ts']),
  });
  getRepoRoot.mockResolvedValue(repoRoot);
  getStatuses.mockImplementation(() => statusesFixture);
  graphStatus.mockResolvedValue({ value: 'ready' });
  storiesForFiles.mockImplementation(async ({ files }: { files: string[] }) =>
    files.map((file) => graphMatchesByFile.get(file) ?? [])
  );
});

afterAll(() => {
  cwd.mockRestore();
  vol.reset();
});

describe('stories API', () => {
  it('returns compact Markdown preview URLs by default', async () => {
    const storiesToolset = createToolset();

    await expect(
      storiesToolset.methods.preview.handler(
        v.parse(storiesToolset.methods.preview.schema, {
          stories: [{ storyId: 'button--primary' }],
        }),
        ctx
      )
    ).resolves.toBe(
      [
        '# Story previews',
        '- Button - Primary',
        '  http://localhost:6006/?path=/story/button--primary',
      ].join('\n')
    );
  });

  it('returns the structured preview result when the adapter requests JSON', async () => {
    ctx.format = 'json';
    const storiesToolset = createToolset();

    await expect(
      storiesToolset.methods.preview.handler(
        v.parse(storiesToolset.methods.preview.schema, {
          stories: [{ storyId: 'button--primary' }],
        }),
        ctx
      )
    ).resolves.toEqual({
      stories: [
        {
          title: 'Button',
          name: 'Primary',
          previewUrl: 'http://localhost:6006/?path=/story/button--primary',
        },
      ],
    });
    expect(getIndex).toHaveBeenCalledOnce();
  });

  it('formats component matches using the module graph from context', async () => {
    const storiesToolset = createToolset();

    await expect(
      storiesToolset.methods.findByComponent.handler(
        v.parse(storiesToolset.methods.findByComponent.schema, { componentPaths: [componentPath] }),
        ctx
      )
    ).resolves.toBe(
      [
        '# Stories by component',
        `## ${componentPath}`,
        '- Button - Primary (button--primary, distance 1)',
        '  ./src/Button.stories.tsx',
      ].join('\n')
    );
    expect(ctx.getService).toHaveBeenCalledWith('core/module-graph', { internal: true });
    expect(storiesForFiles).toHaveBeenCalledWith({ files: [componentPath] });
  });

  it('returns structured component matches when the adapter requests JSON', async () => {
    ctx.format = 'json';
    const storiesToolset = createToolset();

    await expect(
      storiesToolset.methods.findByComponent.handler(
        v.parse(storiesToolset.methods.findByComponent.schema, { componentPaths: [componentPath] }),
        ctx
      )
    ).resolves.toEqual({
      results: [
        {
          componentPath,
          matches: [
            {
              storyId: 'button--primary',
              title: 'Button',
              name: 'Primary',
              importPath: './src/Button.stories.tsx',
              distance: 1,
            },
          ],
        },
      ],
    });
  });

  it('returns compact Markdown for changed stories by default', async () => {
    statusesFixture = {
      'button--primary': {
        [CHANGE_DETECTION_STATUS_TYPE_ID]: {
          storyId: 'button--primary',
          value: 'status-value:new',
        },
      },
    };
    const storiesToolset = createToolset();

    await expect(
      storiesToolset.methods.changed.handler(
        v.parse(storiesToolset.methods.changed.schema, {}),
        ctx
      )
    ).resolves.toBe(
      [
        '# Changed stories',
        'New: 1, modified: 0, affected: 0',
        '- [new] Button - Primary',
        '',
        '## Unreachable files',
        `- ${themePath}`,
      ].join('\n')
    );
    expect(getStatuses).toHaveBeenCalledOnce();
    expect(getChangedFiles).toHaveBeenCalledOnce();
    expect(getRepoRoot).toHaveBeenCalledOnce();
    expect(ctx.getService).toHaveBeenCalledWith('core/module-graph', { internal: true });
    expect(storiesForFiles).toHaveBeenCalledWith({
      files: [componentPath, themePath],
    });
  });

  it('anchors Git-relative paths when Storybook runs below the repository root', async () => {
    const storiesToolset = createToolset();

    await storiesToolset.methods.changed.handler(
      v.parse(storiesToolset.methods.changed.schema, {}),
      ctx
    );

    expect(process.cwd()).toBe(storybookWorkingDir);
    expect(storiesForFiles).toHaveBeenCalledWith({
      files: [componentPath, themePath],
    });
  });

  it('returns structured changed stories when the adapter requests JSON', async () => {
    ctx.format = 'json';
    statusesFixture = {
      'button--primary': {
        [CHANGE_DETECTION_STATUS_TYPE_ID]: {
          storyId: 'button--primary',
          value: 'status-value:modified',
        },
      },
    };
    const storiesToolset = createToolset();

    await expect(
      storiesToolset.methods.changed.handler(
        v.parse(storiesToolset.methods.changed.schema, {}),
        ctx
      )
    ).resolves.toEqual({
      stories: [
        {
          storyId: 'button--primary',
          statusValue: 'status-value:modified',
          title: 'Button',
          name: 'Primary',
          importPath: './src/Button.stories.tsx',
        },
      ],
      counts: { new: 0, modified: 1, affected: 0 },
      unreachableFiles: [themePath],
    });
  });
});
