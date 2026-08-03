import { existsSync } from 'node:fs';

import type { StoryIndex } from 'storybook/internal/types';

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as v from 'valibot';
import { vol } from 'memfs';

import { resolveToolsetDescription, type ToolsetCtx } from '../../toolset-definition.ts';
import { CHANGE_DETECTION_STATUS_TYPE_ID } from '../../../status-store/index.ts';
import { createStoriesToolset, type StoriesToolset } from './definition.ts';

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
// Git reports paths relative to the repository root, and the response echoes them in that form.
const changedComponentFile = 'packages/ui/src/Button.tsx';
const changedThemeFile = 'packages/ui/src/theme.ts';

const buttonStoryHit = { storyFile: './src/Button.stories.tsx', depth: 1 };

const getIndex = vi.fn();
const getChangedFiles = vi.fn();
const getRepoRoot = vi.fn();
const getStatuses = vi.fn();
const graphStatus = vi.fn();
const storiesForFiles = vi.fn();
const telemetry = vi.fn();
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
let cliCtx: ToolsetCtx;
let mcpCtx: ToolsetCtx;
let toolset: StoriesToolset;

function createToolset({ reviewEnabled = false } = {}): StoriesToolset {
  return createStoriesToolset({ storyIndex, git, changeStatuses, reviewEnabled });
}

function runChanged(ctx: ToolsetCtx = cliCtx, target: StoriesToolset = toolset) {
  return target.methods.changed.handler(v.parse(target.methods.changed.schema, {}), ctx);
}

/** Marks a changed file as reachable from a story, which keeps it out of `unreachableFiles`. */
function markReachable(absolutePath: string) {
  graphMatchesByFile.set(absolutePath, [buttonStoryHit]);
}

function markChanged(storyId: string, value: string) {
  statusesFixture[storyId] = {
    [CHANGE_DETECTION_STATUS_TYPE_ID]: { storyId, value },
  };
}

beforeEach(async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');

  vi.clearAllMocks();
  vol.reset();
  vol.fromNestedJSON({ [componentPath]: '' });
  vi.mocked(existsSync).mockImplementation(memfs.fs.existsSync as typeof existsSync);
  cwd.mockReturnValue(storybookWorkingDir);
  statusesFixture = {};
  graphMatchesByFile = new Map([[componentPath, [buttonStoryHit]]]);
  cliCtx = {
    consumer: 'cli',
    origin: 'http://localhost:6006',
    getService: vi.fn(() => moduleGraph) as ToolsetCtx['getService'],
    telemetry,
  };
  mcpCtx = { ...cliCtx, consumer: 'mcp' };
  getIndex.mockResolvedValue(index);
  getChangedFiles.mockResolvedValue({
    changed: new Set([changedComponentFile]),
    new: new Set([changedThemeFile]),
  });
  getRepoRoot.mockResolvedValue(repoRoot);
  getStatuses.mockImplementation(() => statusesFixture);
  graphStatus.mockResolvedValue({ value: 'ready' });
  storiesForFiles.mockImplementation(async ({ files }: { files: string[] }) =>
    files.map((file) => graphMatchesByFile.get(file) ?? [])
  );
  toolset = createToolset();
});

afterAll(() => {
  cwd.mockRestore();
  vol.reset();
});

describe('stories.preview', () => {
  it('resolves story ids against the live index', async () => {
    const outcome = await toolset.methods.preview.handler(
      v.parse(toolset.methods.preview.schema, { stories: [{ storyId: 'button--primary' }] }),
      cliCtx
    );

    expect(outcome.ok).toBe(true);
    expect(outcome.data).toEqual({
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

  it('renders compact Markdown preview URLs', async () => {
    const outcome = await toolset.methods.preview.handler(
      v.parse(toolset.methods.preview.schema, { stories: [{ storyId: 'button--primary' }] }),
      cliCtx
    );

    expect(outcome.markdown).toBe(
      [
        '# Story previews',
        '- Button - Primary',
        '  http://localhost:6006/?path=/story/button--primary',
      ].join('\n')
    );
  });
});

describe('stories.changed', () => {
  it('enriches change-detection statuses and lists unreachable working-tree files', async () => {
    markChanged('button--primary', 'status-value:modified');

    const outcome = await runChanged();

    expect(outcome.ok).toBe(true);
    expect(outcome.data).toEqual({
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
      unreachableFiles: [changedThemeFile],
    });
    expect(getStatuses).toHaveBeenCalledOnce();
    expect(cliCtx.getService).toHaveBeenCalledWith('core/module-graph', { internal: true });
  });

  it('degrades to "no changes detected" when git is unusable, as the pre-toolset tool did', async () => {
    getChangedFiles.mockRejectedValue(new Error('not a git repository'));
    getRepoRoot.mockRejectedValue(new Error('not a git repository'));

    const outcome = await runChanged(mcpCtx);

    expect(outcome.data.stories).toEqual([]);
    expect(outcome.data.unreachableFiles).toEqual([]);
    expect(outcome.markdown).toBe('No new, modified, or related stories detected.');
  });

  it('anchors Git-relative paths at the repository root, not the Storybook working directory', async () => {
    await runChanged();

    expect(process.cwd()).toBe(storybookWorkingDir);
    expect(storiesForFiles).toHaveBeenCalledWith({ files: [componentPath, themePath] });
  });

  it('reports the per-status counts', async () => {
    markChanged('button--primary', 'status-value:new');

    await runChanged();

    expect(telemetry).toHaveBeenCalledWith('tool:getChangedStories', {
      storyCount: 1,
      newStoryCount: 1,
      modifiedStoryCount: 0,
      affectedStoryCount: 0,
    });
  });

  describe('rendering', () => {
    it('summarizes counts and unreachable files for the CLI', async () => {
      markChanged('button--primary', 'status-value:new');
      const outcome = await runChanged();

      expect(outcome.markdown).toBe(
        [
          '# Changed stories',
          'New: 1, modified: 0, affected: 0',
          '- [new] Button - Primary',
          '',
          '## Unreachable files',
          `- ${changedThemeFile}`,
        ].join('\n')
      );
    });

    it('buckets stories by status for MCP', async () => {
      markChanged('button--primary', 'status-value:new');
      markReachable(themePath);
      const outcome = await runChanged(mcpCtx);

      expect(outcome.markdown).toBe(
        `Detected 1 changed story (1 new, 0 modified, 0 related).

New stories:
- \`button--primary\`: Button / Primary (\`./src/Button.stories.tsx\`)`
      );
    });

    it('points MCP at the review tool as the next step when reviews are enabled', async () => {
      markChanged('button--primary', 'status-value:new');
      markReachable(themePath);
      const withReviews = createToolset({ reviewEnabled: true });
      const outcome = await runChanged(mcpCtx, withReviews);

      expect(outcome.markdown).toBe(
        `Detected 1 changed story (1 new, 0 modified, 0 related).

Next: if the change is visually observable, publish the review now — call **display-review** curating these story IDs. That review link is how you finish; do not substitute individual preview URLs for it.

New stories:
- \`button--primary\`: Button / Primary (\`./src/Button.stories.tsx\`)`
      );
    });

    it('brackets a non-empty MCP result with a coverage banner and a sanity-check note', async () => {
      markChanged('button--primary', 'status-value:new');
      const outcome = await runChanged(mcpCtx);

      expect(outcome.markdown).toBe(
        `⚠ Coverage gap: 1 modified file unreachable from any story (${changedThemeFile}) — full sanity-check note at end of this response.

Detected 1 changed story (1 new, 0 modified, 0 related).

New stories:
- \`button--primary\`: Button / Primary (\`./src/Button.stories.tsx\`)

Coverage sanity check: the working tree also contains modified file(s) that aren't reachable from any story above (no static import path connects them — typically theme tokens, decorators, or other preview-runtime files):
- ${changedThemeFile}

The list above is real but may be stale w.r.t. these files — they're often left over from an earlier sub-change in the same diff. Before composing a review, grep the codebase for their exports and call \`get-stories-by-component\` with the runtime consumers' file paths. Do not assume the list above already covers them, and never invent story IDs to fill the gap.`
      );
    });

    it('tells MCP how to recover when nothing changed but files are unreachable', async () => {
      const outcome = await runChanged(mcpCtx);

      expect(outcome.markdown).toBe(
        `No new, modified, or related stories detected.

The following working-tree file(s) are modified but unreachable from any story (no static import path connects them — they are likely theme tokens, decorators, or other Storybook-preview-runtime files):
- ${changedThemeFile}

For these, grep the codebase for their exports (e.g. specific tokens or symbols) to find runtime consumers, then call \`get-stories-by-component\` with those consumer file paths.`
      );
    });
  });
});

describe('stories.findByComponent', () => {
  it('returns index-backed matches from the module graph in context', async () => {
    const outcome = await toolset.methods.findByComponent.handler(
      v.parse(toolset.methods.findByComponent.schema, { componentPaths: [componentPath] }),
      cliCtx
    );

    expect(outcome.ok).toBe(true);
    expect(outcome.data).toEqual({
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
    expect(cliCtx.getService).toHaveBeenCalledWith('core/module-graph', { internal: true });
    expect(storiesForFiles).toHaveBeenCalledWith({ files: [componentPath] });
  });

  it('renders a headed section per component', async () => {
    const outcome = await toolset.methods.findByComponent.handler(
      v.parse(toolset.methods.findByComponent.schema, { componentPaths: [componentPath] }),
      cliCtx
    );

    expect(outcome.markdown).toBe(
      [
        '# Stories by component',
        `## ${componentPath}`,
        '- Button - Primary (button--primary, distance 1)',
        '  ./src/Button.stories.tsx',
      ].join('\n')
    );
  });
});

describe('descriptions', () => {
  it('names sibling tools the way an MCP client calls them', () => {
    expect(resolveToolsetDescription(toolset.methods.changed.description, mcpCtx)).toContain(
      'get-stories-by-component'
    );
  });

  it('names sibling tools as CLI commands', () => {
    expect(resolveToolsetDescription(toolset.methods.changed.description, cliCtx)).toContain(
      'npx storybook tools stories find-by-component'
    );
  });
});
