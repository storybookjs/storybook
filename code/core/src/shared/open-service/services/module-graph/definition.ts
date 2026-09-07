import * as v from 'valibot';

import { defineService } from '../../service-definition.ts';
import type { ServiceInstanceOf } from '../../types.ts';
import type { ModuleGraphIndexService } from '../module-graph-index/definition.ts';
import { storiesByFileSchema, storyIndexPathSchema } from './schemas.ts';
import type { ModuleGraphServiceState } from './types.ts';
import { toStoryIndexPath } from './types.ts';

const errorLikeSchema: v.GenericSchema = v.object({
  message: v.pipe(v.string(), v.description('Human-readable error message.')),
  name: v.optional(v.pipe(v.string(), v.description('Error class/name, when available.'))),
  stack: v.optional(v.pipe(v.string(), v.description('Stack trace, when available.'))),
  cause: v.optional(v.lazy(() => errorLikeSchema)),
});

const moduleGraphStatusSchema = v.variant('value', [
  v.object({
    value: v.literal('booting'),
  }),
  v.object({
    value: v.literal('ready'),
  }),
  v.object({
    value: v.literal('error'),
    error: v.pipe(
      errorLikeSchema,
      v.description('Serializable error describing why the module graph failed unexpectedly.')
    ),
  }),
  v.object({
    value: v.literal('unavailable'),
    reason: v.pipe(
      v.string(),
      v.description(
        'Human-readable reason why the current builder/runtime cannot provide module graph functionality.'
      )
    ),
    error: v.optional(
      v.pipe(
        errorLikeSchema,
        v.description('Optional serializable error reported by the builder adapter.')
      )
    ),
  }),
]);

const noInputSchema = v.undefined();

const changeDetectionReadinessSchema = v.variant('status', [
  v.object({
    status: v.literal('pending'),
  }),
  v.object({
    status: v.literal('ready'),
  }),
  v.object({
    status: v.literal('unavailable'),
    reason: v.pipe(
      v.string(),
      v.description('Why change detection cannot publish statuses, such as disabled or no git.')
    ),
    error: v.optional(
      v.object({
        message: v.pipe(
          v.string(),
          v.description('Optional diagnostic from the provider that marked scanning unavailable.')
        ),
      })
    ),
  }),
  v.object({
    status: v.literal('error'),
    error: v.object({
      message: v.pipe(v.string(), v.description('Human-readable scan failure message.')),
    }),
  }),
]);

export type ChangeDetectionReadinessResult = v.InferOutput<typeof changeDetectionReadinessSchema>;

export type { ModuleGraphServiceState } from './types.ts';

export const moduleGraphServiceDef = defineService({
  id: 'core/module-graph',
  internal: true,
  description:
    'Story module dependency graph: status and revision counters for reactive updates. The reverse index lives in `core/module-graph-index`.',
  initialState: {
    workingDir: process.cwd(),
    status: { value: 'booting' },
    graphRevision: 0,
    fileActivityRevision: 0,
    storyChangeRevisions: {},
    latestChangedStoryFiles: [],
    changeDetectionReadiness: { status: 'pending' },
  } as ModuleGraphServiceState,
  queries: {
    status: {
      description:
        'Current module graph lifecycle status. `booting` means the graph is still expected to become ready; `ready` means query state is populated; `error` means an unexpected graph failure; `unavailable` means the current builder/runtime cannot provide module graph functionality.',
      input: noInputSchema,
      output: moduleGraphStatusSchema,
      load: async (_input, ctx) => {
        await ctx.self.commands._waitForSettledEngine(undefined);
      },
      handler: (_input, ctx) => ctx.self.state.status,
    },
    changeDetectionReadiness: {
      description:
        'Change-detection scan readiness. Distinct from `status`: the graph can be ready while change detection is disabled or its initial scan has failed.',
      input: noInputSchema,
      output: changeDetectionReadinessSchema,
      load: async (_input, ctx) => {
        await ctx.self.commands._waitForChangeDetectionReadiness(undefined);
      },
      handler: (_input, ctx) => ctx.self.state.changeDetectionReadiness,
    },
    graphRevision: {
      description:
        'Monotonic revision counter for module graph changes, advanced only by in-graph file changes and story-index reconciliation (out-of-graph file changes never advance it). Omit the input to watch the entire graph. Provide `storyFiles` to scope the watch to specific stories: returns the highest revision at which any of those story subgraphs last changed (0 if none have changed yet, or for unknown stories).',
      input: v.optional(
        v.object({
          storyFiles: v.array(
            v.pipe(
              v.string(),
              v.description(
                'Story file to scope the watch to. Accepts absolute paths, story-index-style relative paths with `./`, or relative paths without `./`. Pass an empty array to watch nothing (returns 0).'
              )
            )
          ),
        })
      ),
      output: v.number(),
      handler: (input, ctx) => {
        if (!input) {
          return ctx.self.state.graphRevision;
        }
        if (input.storyFiles.length === 0) {
          return 0;
        }

        let max = 0;
        const { workingDir } = ctx.self.state;
        for (const file of input.storyFiles) {
          const revision =
            ctx.self.state.storyChangeRevisions[toStoryIndexPath(file, workingDir)] ?? 0;
          if (revision > max) {
            max = revision;
          }
        }
        return max;
      },
    },
    fileActivityRevision: {
      description:
        'Monotonic counter advanced on every processed file-change event, including out-of-graph paths that do not advance `graphRevision`. Change detection watches this to rescan git after working-tree edits.',
      input: noInputSchema,
      output: v.number(),
      handler: (_input, ctx) => ctx.self.state.fileActivityRevision,
    },
    latestStoryChanges: {
      description:
        'Latest story files whose module graph changed, paired with the graph revision that produced the change set.',
      input: noInputSchema,
      output: v.object({
        revision: v.pipe(
          v.number(),
          v.description('Graph revision number for this latest story change set.')
        ),
        storyFiles: v.pipe(
          v.array(storyIndexPathSchema),
          v.description(
            'Story-index-relative story files touched by the latest module graph change set.'
          )
        ),
      }),
      handler: (_input, ctx) => ({
        revision: ctx.self.state.graphRevision,
        storyFiles: ctx.self.state.latestChangedStoryFiles,
      }),
    },
    /** @deprecated Use {@link status} instead. */
    getStatus: {
      description: 'Deprecated alias for `status`. Use `status` instead.',
      input: noInputSchema,
      output: moduleGraphStatusSchema,
      handler: (input, ctx) => ctx.self.queries.status.get(input),
      load: async (input, ctx) => {
        await ctx.self.queries.status.loaded(input);
      },
    },
    /** @deprecated Use {@link graphRevision} instead. */
    getGraphRevision: {
      description: 'Deprecated alias for `graphRevision`. Use `graphRevision` instead.',
      input: v.optional(
        v.object({
          storyFiles: v.array(
            v.pipe(
              v.string(),
              v.description(
                'Story file to scope the watch to. Accepts absolute paths, story-index-style relative paths with `./`, or relative paths without `./`. Pass an empty array to watch nothing (returns 0).'
              )
            )
          ),
        })
      ),
      output: v.number(),
      handler: (input, ctx) => ctx.self.queries.graphRevision.get(input),
      load: async (input, ctx) => {
        await ctx.self.queries.graphRevision.loaded(input);
      },
    },
  },
  commands: {
    _applyGraphSnapshot: {
      internal: true,
      description:
        'Replaces the reverse index after the initial graph build. Called by the graph engine, not by external consumers.',
      input: v.object({
        storiesByFile: v.pipe(
          storiesByFileSchema,
          v.description(
            'Complete relative reverse index keyed by story-index-style source file paths. Values map affected story-index-style story file paths to breadth-first-search depths.'
          )
        ),
      }),
      output: v.void(),
      handler: async (input, ctx) => {
        await ctx
          .getService<ModuleGraphIndexService>('core/module-graph-index', { internal: true })
          .commands._applyIndex({
            storiesByFile: input.storiesByFile,
          });
        ctx.self.setState((state) => {
          state.status = { value: 'ready' };
          // The snapshot is the baseline, not a change, so it does not advance the revision. Seed
          // every known story to revision 0 so scoped `graphRevision` reads track existing keys
          // and observe later per-story bumps.
          state.storyChangeRevisions = {};
          for (const stories of Object.values(input.storiesByFile)) {
            for (const storyFile of Object.keys(stories)) {
              state.storyChangeRevisions[storyFile] = 0;
            }
          }
          state.latestChangedStoryFiles = [];
        });
      },
    },
    _applyGraphUpdate: {
      internal: true,
      description:
        'Advances file activity for every processed file event. When `bumpedStoryFiles` is non-empty, also bumps graph revision and records those stories. Called by the graph engine after any index apply for the same patch; does not write the reverse index.',
      input: v.object({
        bumpedStoryFiles: v.pipe(
          v.array(storyIndexPathSchema),
          v.description(
            'Story files whose graph changed, using story-index-style relative paths. Each listed file has its version incremented.'
          )
        ),
      }),
      output: v.void(),
      handler: async (input, ctx) => {
        ctx.self.setState((state) => {
          // Every processed file event advances file activity so change detection can rescan git,
          // even when the path is out of graph (empty bumpedStoryFiles) and graphRevision stays put.
          state.fileActivityRevision += 1;
          // An out-of-graph file change bumps no stories; it must not advance graphRevision, so
          // review / scoped subscribers stay put.
          if (input.bumpedStoryFiles.length === 0) {
            return;
          }
          state.graphRevision += 1;
          state.latestChangedStoryFiles = input.bumpedStoryFiles;
          for (const storyFile of input.bumpedStoryFiles) {
            state.storyChangeRevisions[storyFile] = state.graphRevision;
          }
        });
      },
    },
    _setStatus: {
      internal: true,
      description:
        'Sets the module graph lifecycle status after engine startup, failure, or adapter availability changes.',
      input: moduleGraphStatusSchema,
      output: v.void(),
      handler: async (input, ctx) => {
        ctx.self.setState((state) => {
          state.status = input as ModuleGraphServiceState['status'];
        });
      },
    },
    _waitForSettledEngine: {
      internal: true,
      description:
        'Starts the engine if needed and waits until its current build or patch cycle has finished. Handler is supplied at server registration.',
      input: noInputSchema,
      output: v.void(),
    },
    _waitForChangeDetectionReadiness: {
      internal: true,
      description:
        'Waits until change-detection scan readiness is published on the process that owns the scanner.',
      input: noInputSchema,
      output: changeDetectionReadinessSchema,
    },
  },
});

export type ModuleGraphService = ServiceInstanceOf<typeof moduleGraphServiceDef>;
