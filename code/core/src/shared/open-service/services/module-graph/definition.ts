import * as v from 'valibot';

import { defineService } from '../../service-definition.ts';
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

/**
 * Reverse index shape `sourceFile -> storyFile -> breadth-first-search depth`. The depth is the
 * shortest number of import edges between the source file and the affected story file.
 */
const storyIndexPathSchema = v.pipe(
  v.string(),
  v.description('A story-index-style relative path such as `./src/Button.stories.tsx`.')
);
const storyDependencyDepthSchema = v.pipe(
  v.number(),
  v.description(
    'Breadth-first-search depth: the shortest number of import edges between the source file and this story file.'
  )
);
const storiesByFileSchema = v.record(
  storyIndexPathSchema,
  v.record(storyIndexPathSchema, storyDependencyDepthSchema)
);

/** Queries with no caller input — only `undefined` is accepted. Reused across several queries. */
const noInputSchema = v.undefined();

export type { ModuleGraphServiceState } from './types.ts';

export const moduleGraphServiceDef = defineService({
  id: 'core/module-graph',
  description:
    'Story module dependency graph: reverse index from source files to story files, with reactive updates.',
  initialState: {
    workingDir: process.cwd(),
    status: { value: 'booting' },
    graphRevision: 0,
    storiesByFile: {},
    storyChangeRevisions: {},
    latestChangedStoryFiles: [],
  } as ModuleGraphServiceState,
  queries: {
    getStoriesForFiles: {
      description:
        'Returns, for each input file (same order), story-index-relative story files that depend on it and their breadth-first-search depth: the shortest number of import edges between the input file and the story file.',
      input: v.object({
        files: v.pipe(
          v.array(
            v.pipe(
              v.string(),
              v.description(
                'Input source file path. Accepts absolute paths, story-index-style relative paths with `./`, or relative paths without `./`.'
              )
            )
          ),
          v.description('Source files to look up. Output arrays match this input order.')
        ),
      }),
      output: v.array(
        v.array(
          v.object({
            storyFile: v.pipe(
              storyIndexPathSchema,
              v.description(
                'Affected story file, returned in the same `./`-prefixed relative import-path format used by the story index.'
              )
            ),
            depth: storyDependencyDepthSchema,
          })
        )
      ),
      handler: (input, ctx) => {
        const { workingDir } = ctx.self.state;
        return input.files.map((file) => {
          const entries = ctx.self.state.storiesByFile[toStoryIndexPath(file, workingDir)];
          if (!entries) {
            return [];
          }
          return Object.entries(entries).map(([storyFile, depth]) => ({
            storyFile,
            depth,
          }));
        });
      },
    },
    getStatus: {
      description:
        'Current module graph lifecycle status. `booting` means the graph is still expected to become ready; `ready` means query state is populated; `error` means an unexpected graph failure; `unavailable` means the current builder/runtime cannot provide module graph functionality.',
      input: noInputSchema,
      output: moduleGraphStatusSchema,
      handler: (_input, ctx) => ctx.self.state.status,
    },
    getGraphRevision: {
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
    getLatestStoryChanges: {
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
  },
  commands: {
    applyGraphSnapshot: {
      description:
        'Internal use only: replaces the reverse index after the initial graph build. Called by the graph engine, not by external consumers.',
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
        ctx.self.setState((state) => {
          state.status = { value: 'ready' };
          state.storiesByFile = input.storiesByFile;
          // The snapshot is the baseline, not a change, so it does not advance the revision. Seed
          // every known story to revision 0 so scoped `getGraphRevision` reads track existing keys
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
    applyGraphUpdate: {
      description:
        'Internal use only: replaces the reverse index after an incremental patch and bumps versions for affected story files. Called by the graph engine, not by external consumers.',
      input: v.object({
        storiesByFile: v.pipe(
          storiesByFileSchema,
          v.description(
            'Complete relative reverse index keyed by story-index-style source file paths. Values map affected story-index-style story file paths to breadth-first-search depths.'
          )
        ),
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
          state.storiesByFile = input.storiesByFile;
          // An out-of-graph file change recomputes the (unchanged) reverse index but bumps no
          // stories; it must not advance the revision, so watch-all and scoped subscribers stay put.
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
    bumpGraphRevision: {
      description:
        'Internal use only: bumps the graph revision when the story index invalidates without an immediate graph snapshot/update.',
      input: noInputSchema,
      output: v.void(),
      handler: async (_input, ctx) => {
        ctx.self.setState((state) => {
          state.graphRevision += 1;
          state.latestChangedStoryFiles = [];
        });
      },
    },
    setStatus: {
      description:
        'Internal use only: sets the module graph lifecycle status after engine startup, failure, or adapter availability changes.',
      input: moduleGraphStatusSchema,
      output: v.void(),
      handler: async (input, ctx) => {
        ctx.self.setState((state) => {
          state.status = input as ModuleGraphServiceState['status'];
        });
      },
    },
  },
});
