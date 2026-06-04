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

const moduleGraphStatusSchema = v.variant('status', [
  v.object({
    status: v.literal('booting'),
  }),
  v.object({
    status: v.literal('ready'),
  }),
  v.object({
    status: v.literal('error'),
    error: v.pipe(
      errorLikeSchema,
      v.description('Serializable error describing why the module graph failed unexpectedly.')
    ),
  }),
  v.object({
    status: v.literal('unavailable'),
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
    status: { status: 'booting' },
    graphRevision: 0,
    storiesByFile: {},
    storyVersions: {},
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
        return input.files.map((file) => {
          const entries = ctx.self.state.storiesByFile[toStoryIndexPath(file, process.cwd())];
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
        'Monotonic counter bumped on every graph update (patch or index reconciliation).',
      input: noInputSchema,
      output: v.number(),
      handler: (_input, ctx) => ctx.self.state.graphRevision,
    },
    getStoryVersion: {
      description:
        'Per-story-file version; increments when that story or any module in its graph changes.',
      input: v.object({
        storyFile: v.pipe(
          v.string(),
          v.description(
            'Story file path. Accepts absolute paths, story-index-style relative paths with `./`, or relative paths without `./`.'
          )
        ),
      }),
      output: v.number(),
      handler: (input, ctx) =>
        ctx.self.state.storyVersions[toStoryIndexPath(input.storyFile, process.cwd())] ?? 0,
    },
    getAllStoryVersions: {
      description:
        'Full map of story-index-relative story file paths (`./src/Button.stories.tsx`) to versions, for bulk change subscriptions.',
      input: noInputSchema,
      output: v.record(
        storyIndexPathSchema,
        v.pipe(
          v.number(),
          v.description(
            'Monotonic per-story version. It increments when that story file or any module in its graph changes.'
          )
        )
      ),
      handler: (_input, ctx) => ctx.self.state.storyVersions,
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
          state.status = { status: 'ready' };
          state.storiesByFile = input.storiesByFile;
          state.graphRevision += 1;
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
          state.graphRevision += 1;
          for (const storyFile of input.bumpedStoryFiles) {
            state.storyVersions[storyFile] = (state.storyVersions[storyFile] ?? 0) + 1;
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
