import { existsSync } from 'node:fs';

import type { StoryIndex } from 'storybook/internal/types';

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as v from 'valibot';
import { vol } from 'memfs';

import { getStatusStoreByTypeId } from '../../../../core-server/stores/status.ts';
import type { ApiCtx } from '../../../public-api/index.ts';
import { CHANGE_DETECTION_STATUS_TYPE_ID } from '../../../status-store/index.ts';
import { createStoriesApi } from './definition.ts';

vi.mock('node:fs', { spy: true });
vi.mock('../../../../core-server/stores/status.ts', { spy: true });

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
let statusesFixture: Record<string, Record<string, unknown>>;
let graphMatchesByFile: Map<string, Array<{ storyFile: string; depth: number }>>;
let ctx: ApiCtx;

function createApi() {
  return createStoriesApi({
    storyIndex,
    git,
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
    getService: vi.fn(() => moduleGraph) as ApiCtx['getService'],
  };
  vi.mocked(getStatusStoreByTypeId).mockReturnValue({ getAll: getStatuses } as never);
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
    const storiesApi = createApi();

    await expect(
      storiesApi.methods.preview.handler(
        v.parse(storiesApi.methods.preview.schema, {
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

  it('returns the structured preview result with json true', async () => {
    const storiesApi = createApi();

    await expect(
      storiesApi.methods.preview.handler(
        v.parse(storiesApi.methods.preview.schema, {
          stories: [{ storyId: 'button--primary' }],
          json: true,
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
    const storiesApi = createApi();

    await expect(
      storiesApi.methods.findByComponent.handler(
        v.parse(storiesApi.methods.findByComponent.schema, { componentPaths: [componentPath] }),
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
    expect(ctx.getService).toHaveBeenCalledWith('core/module-graph');
    expect(storiesForFiles).toHaveBeenCalledWith({ files: [componentPath] });
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
    const storiesApi = createApi();

    await expect(
      storiesApi.methods.changed.handler(v.parse(storiesApi.methods.changed.schema, {}), ctx)
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
    expect(getStatusStoreByTypeId).toHaveBeenCalledWith(CHANGE_DETECTION_STATUS_TYPE_ID);
    expect(getChangedFiles).toHaveBeenCalledOnce();
    expect(getRepoRoot).toHaveBeenCalledOnce();
    expect(ctx.getService).toHaveBeenCalledWith('core/module-graph');
    expect(storiesForFiles).toHaveBeenCalledWith({
      files: [componentPath, themePath],
    });
  });

  it('anchors Git-relative paths when Storybook runs below the repository root', async () => {
    const storiesApi = createApi();

    await storiesApi.methods.changed.handler(v.parse(storiesApi.methods.changed.schema, {}), ctx);

    expect(process.cwd()).toBe(storybookWorkingDir);
    expect(storiesForFiles).toHaveBeenCalledWith({
      files: [componentPath, themePath],
    });
  });

  it('returns structured changed stories with json true', async () => {
    statusesFixture = {
      'button--primary': {
        [CHANGE_DETECTION_STATUS_TYPE_ID]: {
          storyId: 'button--primary',
          value: 'status-value:modified',
        },
      },
    };
    const storiesApi = createApi();

    await expect(
      storiesApi.methods.changed.handler(
        v.parse(storiesApi.methods.changed.schema, { json: true }),
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

  it('creates a definition containing only public API fields', () => {
    const storiesApi = createApi();

    expect(Object.keys(storiesApi)).toEqual(['id', 'description', 'methods']);
    for (const method of Object.values(storiesApi.methods)) {
      expect(Object.keys(method).sort()).toEqual(['description', 'handler', 'schema']);
    }
  });
});
