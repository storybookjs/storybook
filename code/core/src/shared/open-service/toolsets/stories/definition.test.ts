import { existsSync, realpathSync } from 'node:fs';

import type { StoryIndex } from 'storybook/internal/types';

import { toJsonSchema } from '@valibot/to-json-schema';
import { vol } from 'memfs';
import { resolve } from 'pathe';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as v from 'valibot';

import {
  OpenServiceMissingOriginError,
  OpenServiceModuleGraphUnavailableError,
} from '../../../../server-errors.ts';
import { CHANGE_DETECTION_STATUS_TYPE_ID } from '../../../status-store/index.ts';
import { resolveToolsetDescription, type ToolsetCtx } from '../../toolset-definition.ts';
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

// Resolved with pathe — the resolver's own path library — so the fixtures match its output on
// Windows too (drive-letter prefix, forward slashes).
const repoRoot = resolve('/repo');
const storybookWorkingDir = resolve(repoRoot, 'packages/ui');
const componentPath = resolve(storybookWorkingDir, 'src/Button.tsx');
/** On disk, but no story reaches it — the "component without stories yet" case. */
const orphanPath = resolve(storybookWorkingDir, 'src/Orphan.tsx');
const themePath = resolve(storybookWorkingDir, 'src/theme.ts');
// Git reports paths relative to the repository root, and the response echoes them in that form.
const changedComponentFile = 'packages/ui/src/Button.tsx';
const changedThemeFile = 'packages/ui/src/theme.ts';

const buttonStoryHit = { storyFile: './src/Button.stories.tsx', depth: 1 };
const previewUrl = 'http://localhost:6006/?path=/story/button--primary';

const getIndex = vi.fn();
const getChangedFiles = vi.fn();
const getRepoRoot = vi.fn();
const getStatuses = vi.fn();
const graphStatus = vi.fn();
const changeDetectionReadiness = vi.fn();
const storiesForFiles = vi.fn();
const telemetry = vi.fn();
const cwd = vi.spyOn(process, 'cwd');
const moduleGraph = {
  queries: {
    status: { loaded: graphStatus },
    changeDetectionReadiness: { loaded: changeDetectionReadiness },
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
  return createStoriesToolset({
    storyIndex,
    git,
    changeStatuses,
    reviewEnabled,
  });
}

function runPreview(
  stories: Array<Record<string, unknown>>,
  ctx: ToolsetCtx = cliCtx,
  target: StoriesToolset = toolset
) {
  return target.methods.preview.handler(v.parse(target.methods.preview.input, { stories }), ctx);
}

function runChanged(ctx: ToolsetCtx = cliCtx, target: StoriesToolset = toolset) {
  return target.methods.changed.handler(v.parse(target.methods.changed.input, {}), ctx);
}

function runFindByComponent(
  input: Record<string, unknown>,
  ctx: ToolsetCtx = cliCtx,
  target: StoriesToolset = toolset
) {
  return target.methods.findByComponent.handler(
    v.parse(target.methods.findByComponent.input, input),
    ctx
  );
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

beforeEach(() => {
  vi.clearAllMocks();
  vol.reset();
  vol.fromNestedJSON({ [componentPath]: '', [orphanPath]: '' });
  vi.mocked(existsSync).mockImplementation((filePath) => vol.existsSync(filePath));
  vi.mocked(realpathSync.native).mockImplementation((filePath) =>
    String(vol.realpathSync(filePath))
  );
  cwd.mockReturnValue(storybookWorkingDir);
  statusesFixture = {};
  graphMatchesByFile = new Map([[componentPath, [buttonStoryHit]]]);
  cliCtx = {
    transport: 'cli',
    origin: 'http://localhost:6006',
    getService: vi.fn(() => moduleGraph) as ToolsetCtx['getService'],
    telemetry,
  };
  mcpCtx = { ...cliCtx, transport: 'mcp' };
  getIndex.mockResolvedValue(index);
  getChangedFiles.mockResolvedValue({
    changed: new Set([changedComponentFile]),
    new: new Set([changedThemeFile]),
  });
  getRepoRoot.mockResolvedValue(repoRoot);
  getStatuses.mockImplementation(() => statusesFixture);
  changeDetectionReadiness.mockResolvedValue({ status: 'ready' });
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
    const outcome = await runPreview([{ storyId: 'button--primary' }]);

    expect(outcome.ok).toBe(true);
    expect(outcome.data).toEqual({
      stories: [{ title: 'Button', name: 'Primary', previewUrl }],
    });
    expect(getIndex).toHaveBeenCalledOnce();
  });

  it('reports per-input lookup failures instead of failing the call', async () => {
    const outcome = await runPreview([{ storyId: 'gone--story' }]);

    expect(outcome.ok).toBe(true);
    expect(outcome.data).toEqual({
      stories: [
        {
          input: { storyId: 'gone--story' },
          error: 'No story found for story ID "gone--story"',
        },
      ],
    });
  });

  it('rejects when the adapter has no Storybook origin to build URLs from', async () => {
    await expect(
      runPreview([{ storyId: 'button--primary' }], { ...cliCtx, origin: undefined })
    ).rejects.toBeInstanceOf(OpenServiceMissingOriginError);
  });

  it('reports the story counts it resolved', async () => {
    await runPreview([{ storyId: 'button--primary' }, { storyId: 'gone--story' }]);

    expect(telemetry).toHaveBeenCalledWith('tool:previewStories', {
      toolset: 'dev',
      inputStoryCount: 2,
      outputStoryCount: 2,
    });
  });

  describe('rendering', () => {
    it('returns the same text blocks for the CLI as for MCP', async () => {
      const outcome = await runPreview([{ storyId: 'button--primary' }]);
      const mcpOutcome = await runPreview([{ storyId: 'button--primary' }], mcpCtx);

      expect(outcome.markdown).toEqual([previewUrl]);
      expect(outcome.markdown).toEqual(mcpOutcome.markdown);
    });

    it('returns one text block per URL for MCP', async () => {
      const outcome = await runPreview([{ storyId: 'button--primary' }], mcpCtx);

      expect(outcome.markdown).toEqual([previewUrl]);
    });

    it('appends a review nudge for MCP once a URL resolved and reviews exist', async () => {
      const withReviews = createToolset({ reviewEnabled: true });
      const outcome = await runPreview([{ storyId: 'button--primary' }], mcpCtx, withReviews);

      expect(outcome.markdown).toEqual([
        previewUrl,
        'These preview links are for iterating or sharing a specific story — they are not how visual work or a browse request ends. The review-create tool is available in this session: if you are finishing visually observable work or showing a set of stories, publish the review with **review-create** and link that instead.',
      ]);
    });

    it('leaves an all-error result unnudged, since there is nothing to curate', async () => {
      const withReviews = createToolset({ reviewEnabled: true });
      const outcome = await runPreview([{ storyId: 'gone--story' }], mcpCtx, withReviews);

      expect(outcome.markdown).toEqual(['No story found for story ID "gone--story"']);
    });
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
    expect(cliCtx.getService).toHaveBeenCalledTimes(2);
    expect(cliCtx.getService).toHaveBeenCalledWith('core/module-graph', { internal: true });
    expect(cliCtx.getService).toHaveBeenCalledWith('core/module-graph-index', { internal: true });
  });

  it('rejects with the graph reason rather than reporting zero changes', async () => {
    graphStatus.mockResolvedValue({
      value: 'unavailable',
      reason: 'builder does not support change detection',
    });

    const error = await runChanged().catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(OpenServiceModuleGraphUnavailableError);
    expect((error as Error).message).toBe(
      "Storybook's story dependency graph is unavailable: builder does not support change detection. Make sure the dev server is running with a builder that supports change detection."
    );
    expect(getStatuses).not.toHaveBeenCalled();
  });

  it('rejects when change detection is not ready even if the graph is', async () => {
    changeDetectionReadiness.mockResolvedValue({ status: 'unavailable', reason: 'disabled' });

    const error = await runChanged().catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(OpenServiceModuleGraphUnavailableError);
    expect((error as Error).message).toContain('change detection is disabled');
    expect(getStatuses).not.toHaveBeenCalled();
  });

  it('degrades to "no changes detected" when git is unusable, as the pre-toolset tool did', async () => {
    getChangedFiles.mockRejectedValue(new Error('not a git repository'));
    getRepoRoot.mockRejectedValue(new Error('not a git repository'));

    const outcome = await runChanged(mcpCtx);

    expect(outcome.data.stories).toEqual([]);
    expect(outcome.data.unreachableFiles).toEqual([]);
    expect(outcome.markdown).toBe('No new, modified, or related stories detected.');
  });

  it.each(['not a git repository', 'git is not available'] as const)(
    'degrades to "no changes detected" when change detection is unavailable because %s',
    async (reason) => {
      changeDetectionReadiness.mockResolvedValue({ status: 'unavailable', reason });

      const outcome = await runChanged(mcpCtx);

      expect(outcome.data).toEqual({
        stories: [],
        counts: { new: 0, modified: 0, affected: 0 },
        unreachableFiles: [],
      });
      expect(outcome.markdown).toBe('No new, modified, or related stories detected.');
      expect(getStatuses).not.toHaveBeenCalled();
    }
  );

  it('anchors Git-relative paths at the repository root, not the Storybook working directory', async () => {
    await runChanged();

    expect(storiesForFiles).toHaveBeenCalledWith({ files: [componentPath, themePath] });
  });

  it('reports the per-status counts', async () => {
    markChanged('button--primary', 'status-value:new');

    await runChanged();

    expect(telemetry).toHaveBeenCalledWith('tool:getChangedStories', {
      toolset: 'dev',
      storyCount: 1,
      newStoryCount: 1,
      modifiedStoryCount: 0,
      affectedStoryCount: 0,
    });
  });

  describe('rendering', () => {
    // Byte parity holds outside the coverage hint, whose tool reference legitimately renders as
    // the CLI command on one transport and the MCP tool name on the other (getToolName).
    it('renders the same bucketed report for the CLI as for MCP', async () => {
      markChanged('button--primary', 'status-value:new');
      markReachable(themePath);
      const outcome = await runChanged();
      const mcpOutcome = await runChanged(mcpCtx);

      expect(outcome.markdown).toContain(
        'Detected 1 changed story (1 new, 0 modified, 0 related).'
      );
      expect(outcome.markdown).toBe(mcpOutcome.markdown);
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

Next: if the change is visually observable, publish the review now — call **review-create** curating these story IDs. That review link is how you finish; do not substitute individual preview URLs for it.

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

The list above is real but may be stale w.r.t. these files — they're often left over from an earlier sub-change in the same diff. Before composing a review, grep the codebase for their exports and call \`stories-find-by-component\` with the runtime consumers' file paths. Do not assume the list above already covers them, and never invent story IDs to fill the gap.`
      );
    });

    it('tells MCP how to recover when nothing changed but files are unreachable', async () => {
      const outcome = await runChanged(mcpCtx);

      expect(outcome.markdown).toBe(
        `No new, modified, or related stories detected.

The following working-tree file(s) are modified but unreachable from any story (no static import path connects them — they are likely theme tokens, decorators, or other Storybook-preview-runtime files):
- ${changedThemeFile}

For these, grep the codebase for their exports (e.g. specific tokens or symbols) to find runtime consumers, then call \`stories-find-by-component\` with those consumer file paths.`
      );
    });
  });
});

describe('stories.findByComponent', () => {
  it('returns index-backed matches together with the ceiling that was applied', async () => {
    const outcome = await runFindByComponent({ componentPaths: [componentPath] });

    expect(outcome.ok).toBe(true);
    expect(outcome.data).toEqual({
      maxDistance: 3,
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
    expect(cliCtx.getService).toHaveBeenCalledWith('core/module-graph-index', { internal: true });
    expect(storiesForFiles).toHaveBeenCalledWith({ files: [componentPath] });
  });

  it('echoes a caller-supplied ceiling', async () => {
    const outcome = await runFindByComponent({ componentPaths: [componentPath], maxDistance: 1 });

    expect(outcome.data).toMatchObject({ maxDistance: 1 });
  });

  it('rejects with the graph reason rather than answering "no stories"', async () => {
    graphStatus.mockResolvedValue({
      value: 'unavailable',
      reason: 'builder does not support change detection',
    });

    const error = await runFindByComponent({ componentPaths: [componentPath] }).catch(
      (reason: unknown) => reason
    );

    expect(error).toBeInstanceOf(OpenServiceModuleGraphUnavailableError);
    // The adapter hands this message straight to the agent, so it must name both the
    // adapter-specific cause the service reported and the remedy that cause does not say.
    expect((error as Error).message).toBe(
      "Storybook's story dependency graph is unavailable: builder does not support change detection. Make sure the dev server is running with a builder that supports change detection."
    );
  });

  it('reports how many of the requested components matched', async () => {
    await runFindByComponent({ componentPaths: [componentPath, orphanPath] });

    expect(telemetry).toHaveBeenCalledWith('tool:getStoriesByComponent', {
      toolset: 'dev',
      componentCount: 2,
      matchedComponentCount: 1,
      totalMatchCount: 1,
      maxDistance: 3,
    });
  });

  describe('rendering', () => {
    it('renders the same distance buckets for the CLI as for MCP', async () => {
      const outcome = await runFindByComponent({ componentPaths: [componentPath] });
      const mcpOutcome = await runFindByComponent({ componentPaths: [componentPath] }, mcpCtx);

      expect(outcome.markdown).toBe(mcpOutcome.markdown);
    });

    it('renders distance buckets without headings for MCP', async () => {
      const outcome = await runFindByComponent({ componentPaths: [componentPath] }, mcpCtx);

      expect(outcome.markdown).toBe(
        `${componentPath}:
→ 1 story across 1 component, distances 1..1 (d1=1)
distance 1:
  - \`button--primary\`: Button / Primary (\`./src/Button.stories.tsx\`)`
      );
    });

    it('tells MCP to re-check a path that does not exist on disk', async () => {
      const outcome = await runFindByComponent({ componentPaths: [themePath] }, mcpCtx);

      expect(outcome.markdown).toBe(
        `${themePath}: path does not exist on disk — re-check the path you sent.`
      );
    });
  });
});

describe('descriptions', () => {
  it('names sibling tools the way an MCP client calls them', () => {
    expect(resolveToolsetDescription(toolset.methods.changed.description, mcpCtx)).toContain(
      'stories-find-by-component'
    );
  });

  it('names sibling tools as CLI commands', () => {
    expect(resolveToolsetDescription(toolset.methods.changed.description, cliCtx)).toContain(
      'npx storybook tools stories find-by-component'
    );
  });

  it('makes preview the end of visual work when no review page exists', () => {
    expect(resolveToolsetDescription(toolset.methods.preview.description, mcpCtx))
      .toBe(`Use this tool to get one or more Storybook preview URLs.
Call it after editing anything that changes how the UI looks — components, stories, styles, CSS, themes, colors, or design tokens — no exceptions. A shared file has no stories of its own: preview the stories of the components that consume it.
Include each returned preview URL in your final user-facing response so users can open them directly.`);
  });

  it('demotes preview to a mid-loop tool when reviews are enabled', () => {
    const withReviews = createToolset({ reviewEnabled: true });

    expect(resolveToolsetDescription(withReviews.methods.preview.description, mcpCtx))
      .toBe(`Use this tool to get Storybook preview URLs while iterating on a specific story, or when the user asks for a direct link to one.
Do not end visual work or browse requests with these links — publish a curated review with review-create instead (passing changedFiles: [] when no code changed) and link that.`);

    expect(resolveToolsetDescription(withReviews.methods.preview.description, cliCtx))
      .toBe(`Use this tool to get Storybook preview URLs while iterating on a specific story, or when the user asks for a direct link to one.
Do not end visual work or browse requests with these links — publish a curated review with npx storybook tools review create instead (passing changedFiles: [] when no code changed) and link that.`);
  });

  it('keeps review-create out of the static preview output schema in both review modes', () => {
    const withoutReviews = createToolset({ reviewEnabled: false });
    const withReviews = createToolset({ reviewEnabled: true });

    for (const target of [withoutReviews, withReviews]) {
      const serialized = JSON.stringify(
        toJsonSchema(target.methods.preview.output as never, { errorMode: 'ignore' })
      );
      expect(serialized).not.toContain('review-create');
      expect(serialized).toContain('Direct URL to open the story preview');
    }
  });

  it('offers the review page as a hand-off target only when reviews are enabled', () => {
    const withReviews = createToolset({ reviewEnabled: true });

    expect(
      resolveToolsetDescription(withReviews.methods.findByComponent.description, mcpCtx)
    ).toContain('hand these to stories-preview or review-create');
    expect(
      resolveToolsetDescription(toolset.methods.findByComponent.description, mcpCtx)
    ).toContain('hand these to stories-preview instead of guessing');
  });
});
