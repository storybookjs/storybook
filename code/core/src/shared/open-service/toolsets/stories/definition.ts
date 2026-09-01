import type { StoryIndex } from 'storybook/internal/types';

import * as v from 'valibot';

import {
  OpenServiceMissingOriginError,
  OpenServiceModuleGraphUnavailableError,
} from '../../../../server-errors.ts';
import type {
  ChangeDetectionReadinessResult,
  ModuleGraphService,
} from '../../services/module-graph/definition.ts';
import type { ModuleGraphIndexService } from '../../services/module-graph-index/definition.ts';
import {
  defineToolset,
  reportToolsetTelemetry,
  type ToolsetCtx,
  type ToolsetOutcome,
} from '../../toolset-definition.ts';
import { getToolName } from '../../toolset-names.ts';
import type { StatusesByStoryIdAndTypeId } from '../../../status-store/index.ts';
import { getChangedStories } from './changed.ts';
import { DEFAULT_MAX_DISTANCE, findStoriesByComponent } from './find-by-component.ts';
import type { ModuleGraphAccess, ModuleGraphStatus } from './resolve-component-stories.ts';
import { reasonForStatus } from './resolve-component-stories.ts';
import { formatChangedStories, formatFindByComponent, formatPreviewStories } from './format.ts';
import { previewStories } from './preview-stories.ts';
import { storyInputArraySchema, storyInputSchema } from './story-input.ts';
import { detectUnreachableFiles } from './unreachable-files.ts';

const previewSuccessSchema = v.object({
  title: v.string(),
  name: v.string(),
  previewUrl: v.pipe(
    v.string(),
    v.description(
      'Direct URL to open the story preview. Include this URL in the final user-facing response so users can open it directly.'
    )
  ),
});

const previewFailureSchema = v.object({
  input: storyInputSchema,
  error: v.string(),
});

const previewOutputSchema = v.object({
  stories: v.array(v.union([previewSuccessSchema, previewFailureSchema])),
});

export type PreviewStoriesOutput = v.InferOutput<typeof previewOutputSchema>;

const changeStatusSchema = v.union([
  v.literal('status-value:new'),
  v.literal('status-value:modified'),
  v.literal('status-value:affected'),
]);

export type ChangeStatusValue = v.InferOutput<typeof changeStatusSchema>;

const changedStorySchema = v.object({
  storyId: v.string(),
  statusValue: changeStatusSchema,
  title: v.string(),
  name: v.string(),
  importPath: v.string(),
});

const changedOutputSchema = v.object({
  stories: v.array(changedStorySchema),
  counts: v.object({
    new: v.number(),
    modified: v.number(),
    affected: v.number(),
  }),
  unreachableFiles: v.array(v.string()),
});

export type ChangedStoriesOutput = v.InferOutput<typeof changedOutputSchema>;

const storyMatchSchema = v.object({
  storyId: v.string(),
  title: v.string(),
  name: v.string(),
  importPath: v.string(),
  distance: v.pipe(
    v.number(),
    v.description(
      'Import-graph depth from the story file to the component (lower = stronger). 0: the path you passed is itself a story file (self-match). 1: story file directly imports the component. 2+: reached through N hops.'
    )
  ),
});

const clippedByMaxDistanceSchema = v.pipe(
  v.object({
    count: v.number(),
    distances: v.array(v.number()),
  }),
  v.description(
    'Present only when `maxDistance` filtered out one or more matches. `count` is how many were dropped; `distances` lists the (sorted, distinct) distances those dropped matches sat at — widen `maxDistance` to include them.'
  )
);

const findByComponentOutputSchema = v.object({
  results: v.array(
    v.object({
      componentPath: v.string(),
      matches: v.array(storyMatchSchema),
      clipped: v.optional(clippedByMaxDistanceSchema),
      pathNotFound: v.pipe(
        v.optional(v.boolean()),
        v.description(
          '`true` when no file exists at the resolved absolute path. Distinguishes a typo from "this component has no stories yet". The agent should re-check the path it sent.'
        )
      ),
    })
  ),
});

/**
 * `maxDistance` echoes the ceiling actually applied so formatters can name it; it is deliberately
 * absent from {@link findByComponentOutputSchema}, which is the published output contract.
 */
export type FindByComponentOutput = v.InferOutput<typeof findByComponentOutputSchema> & {
  maxDistance: number;
};

export type StoryIndexAccess = {
  getIndex: () => Promise<StoryIndex>;
};

export type StoriesGitAccess = {
  getRepoRoot: () => Promise<string>;
  getChangedFiles: () => Promise<{
    changed: Set<string>;
    new: Set<string>;
  }>;
};

export type StoriesChangeStatusesAccess = {
  getAll: () => StatusesByStoryIdAndTypeId | Promise<StatusesByStoryIdAndTypeId>;
};

export type CreateStoriesToolsetOptions = {
  storyIndex: StoryIndexAccess;
  git: StoriesGitAccess;
  /** Change-detection status snapshot; wired by the server host, not imported from core-server. */
  changeStatuses: StoriesChangeStatusesAccess;
  /**
   * Whether curated reviews are available in this Storybook. Reviews are the intended end of visual
   * work, so when they exist several methods steer the agent there instead of at raw preview links.
   */
  reviewEnabled?: boolean;
};

const GIT_UNUSABLE_REASONS = new Set(['not a git repository', 'git is not available']);

function emptyChangedStories(): ChangedStoriesOutput {
  return {
    stories: [],
    counts: { new: 0, modified: 0, affected: 0 },
    unreachableFiles: [],
  };
}

function reasonForChangeDetectionReadiness(
  readiness: Exclude<ChangeDetectionReadinessResult, { status: 'ready' }>
): string {
  switch (readiness.status) {
    case 'unavailable':
      return readiness.reason === 'disabled'
        ? 'Storybook change detection is disabled, so changed-story statuses are unavailable. Enable the changeDetection feature and retry.'
        : `Storybook change detection is unavailable: ${readiness.reason}.`;
    case 'error':
      return `Storybook change detection failed: ${readiness.error.message}`;
    case 'pending':
      return 'Storybook change detection has not finished its initial scan.';
    default: {
      const exhaustive: never = readiness;
      throw exhaustive;
    }
  }
}

function isGitUnusableReadiness(readiness: ChangeDetectionReadinessResult): boolean {
  return readiness.status === 'unavailable' && GIT_UNUSABLE_REASONS.has(readiness.reason);
}

function describePreview(ctx: ToolsetCtx, reviewEnabled: boolean): string {
  if (!reviewEnabled) {
    return `Use this tool to get one or more Storybook preview URLs.
Call it after editing anything that changes how the UI looks — components, stories, styles, CSS, themes, colors, or design tokens — no exceptions. A shared file has no stories of its own: preview the stories of the components that consume it.
Include each returned preview URL in your final user-facing response so users can open them directly.`;
  }

  // With reviews available this is strictly a mid-loop tool: no "include the URLs in your final
  // response" default (that sanctioned preview links as the ending of visual work) and no hedging
  // about the review tool's availability (a hedged "when available" let an agent that wrongly
  // believed the tool was missing treat raw links as a sanctioned fallback).
  return `Use this tool to get Storybook preview URLs while iterating on a specific story, or when the user asks for a direct link to one.
Do not end visual work or browse requests with these links — publish a curated review with ${getToolName(ctx)('review.create')} instead (passing changedFiles: [] when no code changed) and link that.`;
}

function describeChanged(ctx: ToolsetCtx): string {
  return `Get Storybook stories marked as new, modified, or related. Returns story metadata only (no URLs).

The result reflects the cumulative working-tree diff, not just your latest edit — after multiple edits in one session, a non-empty result may cover an earlier sub-change and miss your most recent one. Check that every file you touched is represented; for any that isn't, find its consumer components and pass their paths to ${getToolName(ctx)('stories.findByComponent')} instead. The response surfaces this gap with a "coverage sanity check" hint when it detects unreachable working-tree files.`;
}

function describeFindByComponent(ctx: ToolsetCtx, reviewEnabled: boolean): string {
  const ref = getToolName(ctx);
  const handOffTargets = reviewEnabled
    ? `${ref('stories.preview')} or ${ref('review.create')}`
    : ref('stories.preview');
  const inputShapes = reviewEnabled
    ? `files you just edited, a feature/domain/topic the user named, a query like "all consumers of X", or an autonomous review after a UI change`
    : `files you just edited, a feature/domain/topic the user named, or a query like "all consumers of X"`;
  const cascadeGuidance = reviewEnabled
    ? `For ${ref('review.create')}, the distance buckets map onto the visual cascade (the component itself → direct importers → page-level context) — one collection per layer; when several stories of a component share a distance, prefer the variant whose name signals it renders the changed surface.`
    : `The distance buckets map onto the visual cascade (the component itself → direct importers → page-level context) — use them to decide which stories to preview; when several stories of a component share a distance, prefer the variant whose name signals it renders the changed surface.`;

  return `Map component source files to the stories that render them, returning grounded \`storyId\` values from the live Storybook index — hand these to ${handOffTargets} instead of guessing.

Reach for this whenever you need story IDs, whatever shape the input has: ${inputShapes}. First resolve the input to a list of absolute component file paths using filesystem search (grep / Glob / find) and code reading — that bridge is yours to build; this tool starts where it ends. One common trap: when the changed file is _shared_ infrastructure (theme token, design token, util, hook, CSS module) it isn't itself a component — grep for its consumers and pass _their_ paths, not the shared file's. If the symbol you grepped looks like one member of a related group (sibling tokens, neighboring exports), widen to the rest of the group too — a too-narrow grep silently drops stories. Try \`${ref('stories.changed')}\` first for "I just edited X" when it's available; if a file you touched is missing from its response, treat that file as the shared-infrastructure case and route its consumers through this tool.

Results are sorted by \`distance\` (0 = the path you passed is itself a story file, 1 = direct importer, 2+ = transitive; lower = stronger). Shared primitives are usually consumed through wrapper components, so the distance-1 bucket is often empty — the default \`maxDistance: ${DEFAULT_MAX_DISTANCE}\` keeps that cascade visible while capping noise from wide decorators; raise it to widen recall, lower it to tighten precision. ${cascadeGuidance}

Never invent IDs from file names, feature names, or memory; title strings can be overridden by story authors, so only IDs returned by discovery tools resolve. If a component has no matches here, it has no stories yet (say so, don't fabricate).

Backed by Storybook's live reverse dependency graph, available only when the dev server runs a builder that supports change detection (e.g. Vite) — otherwise returns a typed error.`;
}

// Hot status + cold reverse-index queries, composed for ModuleGraphAccess consumers.
function moduleGraphAccessFromCtx(
  ctx: ToolsetCtx,
  moduleGraph: ModuleGraphService = ctx.getService<ModuleGraphService>('core/module-graph', {
    internal: true,
  })
): ModuleGraphAccess {
  const moduleGraphIndex = ctx.getService<ModuleGraphIndexService>('core/module-graph-index', {
    internal: true,
  });
  return {
    queries: {
      status: {
        loaded: () => moduleGraph.queries.status.loaded(undefined) as Promise<ModuleGraphStatus>,
      },
      storiesForFiles: {
        loaded: (files) => moduleGraphIndex.queries.storiesForFiles.loaded(files),
      },
    },
  };
}

/** Creates the public stories API with request-local access to Storybook runtime dependencies. */
export function createStoriesToolset({
  storyIndex,
  git,
  changeStatuses,
  reviewEnabled = false,
}: CreateStoriesToolsetOptions) {
  return defineToolset({
    id: 'stories',
    description: 'Story discovery, change detection, and preview URL generation.',
    methods: {
      preview: {
        input: v.object({
          stories: v.pipe(
            storyInputArraySchema,
            v.description(
              `Stories to preview.
Prefer { storyId } when you don't already have story file context, since this avoids filesystem discovery.
Use { storyId } when IDs were discovered from documentation tools.
Use { absoluteStoryPath + exportName } only when you're already working in a specific .stories.* file and already have that context.`
            )
          ),
        }),
        output: previewOutputSchema,
        title: 'Get story preview URLs',
        // Preview URLs only work when they point at a live origin.
        requiresDevServer: true,
        description: (ctx) => describePreview(ctx, reviewEnabled),
        handler: async (input, ctx): Promise<ToolsetOutcome<PreviewStoriesOutput, never>> => {
          if (!ctx.origin) {
            throw new OpenServiceMissingOriginError({
              toolsetId: 'stories',
              methodName: 'preview',
            });
          }
          const data = previewStories({
            origin: ctx.origin,
            index: await storyIndex.getIndex(),
            stories: input.stories,
          });

          await reportToolsetTelemetry(ctx, 'tool:previewStories', {
            toolset: 'dev',
            inputStoryCount: input.stories.length,
            outputStoryCount: data.stories.length,
          });

          return { ok: true, data, markdown: formatPreviewStories(data, ctx, { reviewEnabled }) };
        },
      },
      changed: {
        input: v.object({}),
        title: 'Get changed stories metadata',
        description: describeChanged,
        handler: async (_input, ctx): Promise<ToolsetOutcome<ChangedStoriesOutput, never>> => {
          const graphService = ctx.getService<ModuleGraphService>('core/module-graph', {
            internal: true,
          });
          const moduleGraph = moduleGraphAccessFromCtx(ctx, graphService);
          // Same readiness gate as findByComponent: an empty status store is not "no changes", so
          // fail before reading statuses when the graph has not settled.
          const graphStatus = await moduleGraph.queries.status.loaded(undefined);
          if (graphStatus.value !== 'ready') {
            throw new OpenServiceModuleGraphUnavailableError({
              reason: reasonForStatus(graphStatus),
            });
          }

          const changeDetection =
            await graphService.queries.changeDetectionReadiness.loaded(undefined);
          if (changeDetection.status !== 'ready') {
            if (isGitUnusableReadiness(changeDetection)) {
              const data = emptyChangedStories();
              await reportToolsetTelemetry(ctx, 'tool:getChangedStories', {
                toolset: 'dev',
                storyCount: 0,
                newStoryCount: 0,
                modifiedStoryCount: 0,
                affectedStoryCount: 0,
              });
              return {
                ok: true,
                data,
                markdown: formatChangedStories(data, ctx, { reviewEnabled }),
              };
            }
            throw new OpenServiceModuleGraphUnavailableError({
              reason: reasonForChangeDetectionReadiness(changeDetection),
            });
          }

          const [statuses, index] = await Promise.all([
            Promise.resolve(changeStatuses.getAll()),
            storyIndex.getIndex(),
          ]);

          const data = {
            ...getChangedStories({ statuses, index }),
            // Files outside the story graph are why an empty or partial result can still be wrong,
            // so they are part of the answer rather than a separate lookup.
            unreachableFiles: await detectUnreachableFiles({ git, moduleGraph }),
          };

          await reportToolsetTelemetry(ctx, 'tool:getChangedStories', {
            toolset: 'dev',
            storyCount: data.stories.length,
            newStoryCount: data.counts.new,
            modifiedStoryCount: data.counts.modified,
            affectedStoryCount: data.counts.affected,
          });

          return { ok: true, data, markdown: formatChangedStories(data, ctx, { reviewEnabled }) };
        },
      },
      findByComponent: {
        input: v.object({
          componentPaths: v.pipe(
            v.array(v.string()),
            v.minLength(1),
            v.description(
              `Absolute paths to component source files (e.g. "/repo/src/Button.tsx").
Pass the components you actually want stories for — typically files you just read, edited, or that the user mentioned.
Relative paths are also accepted and resolved against the Storybook working directory, but absolute paths are preferred for unambiguous results.
Story files (\`*.stories.*\`) are accepted too: they appear at distance 0 as self-matches, plus any reverse-graph hits (other stories that import them).`
            )
          ),
          maxDistance: v.pipe(
            v.optional(v.pipe(v.number(), v.minValue(1), v.integer())),
            v.description(
              `Ceiling on the import depth to include in results. Must be a positive integer.
- 1: only stories that directly import the component.
- 2+: also include stories that reach the component through N hops.
Defaults to ${DEFAULT_MAX_DISTANCE}; raise it to widen recall, lower it to tighten precision. Shared components (Button, Icon, …) accumulate noisy indirect matches at distance ≥ 3, so the default cap protects against runaway results.`
            )
          ),
        }),
        output: findByComponentOutputSchema,
        title: 'Get stories for component files',
        description: (ctx) => describeFindByComponent(ctx, reviewEnabled),
        handler: async (input, ctx): Promise<ToolsetOutcome<FindByComponentOutput, never>> => {
          const maxDistance = input.maxDistance ?? DEFAULT_MAX_DISTANCE;
          const lookup = await findStoriesByComponent({
            componentPaths: input.componentPaths,
            maxDistance,
            index: await storyIndex.getIndex(),
            moduleGraph: moduleGraphAccessFromCtx(ctx),
          });

          if (!lookup.available) {
            throw new OpenServiceModuleGraphUnavailableError({ reason: lookup.reason });
          }

          const unmatchedCount = lookup.results.filter(
            (result) => !result.pathNotFound && result.matches.length === 0
          ).length;
          await reportToolsetTelemetry(ctx, 'tool:getStoriesByComponent', {
            toolset: 'dev',
            componentCount: input.componentPaths.length,
            matchedComponentCount: input.componentPaths.length - unmatchedCount,
            totalMatchCount: lookup.results.reduce(
              (total, result) => total + result.matches.length,
              0
            ),
            maxDistance,
          });

          const data: FindByComponentOutput = { results: lookup.results, maxDistance };
          return { ok: true, data, markdown: formatFindByComponent(data) };
        },
      },
    },
  });
}

export type StoriesToolset = ReturnType<typeof createStoriesToolset>;
