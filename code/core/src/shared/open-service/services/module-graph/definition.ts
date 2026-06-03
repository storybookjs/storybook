import { normalize } from 'pathe';
import * as v from 'valibot';

import { defineService } from '../../service-definition.ts';
import type { ModuleGraphServiceState } from './types.ts';

/**
 * Reverse index shape `sourceFile -> storyFile -> breadth-first-search depth`. The depth is the
 * shortest number of import edges between the source file and the affected story file.
 */
const storiesByFileSchema = v.record(v.string(), v.record(v.string(), v.number()));

/** Queries with no caller input — only `undefined` is accepted. Reused across several queries. */
const noInputSchema = v.undefined();

export type { ModuleGraphServiceState } from './types.ts';

export const moduleGraphServiceDef = defineService({
  id: 'core/module-graph',
  description:
    'Story module dependency graph: reverse index from source files to story files, with reactive updates.',
  initialState: {
    ready: false,
    graphRevision: 0,
    storiesByFile: {},
    storyVersions: {},
  } as ModuleGraphServiceState,
  queries: {
    getStoriesForFiles: {
      description:
        'Returns, for each input file (same order), story files that depend on it and their breadth-first-search depth: the shortest number of import edges between the input file and the story file.',
      input: v.object({ files: v.array(v.string()) }),
      output: v.array(v.array(v.object({ storyFile: v.string(), depth: v.number() }))),
      handler: (input, ctx) => {
        return input.files.map((file) => {
          const entries = ctx.self.state.storiesByFile[normalize(file)];
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
    getReady: {
      description: 'True once the initial dependency graph has been built.',
      input: noInputSchema,
      output: v.boolean(),
      handler: (_input, ctx) => ctx.self.state.ready,
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
      input: v.object({ storyFile: v.string() }),
      output: v.number(),
      handler: (input, ctx) => ctx.self.state.storyVersions[normalize(input.storyFile)] ?? 0,
    },
    getAllStoryVersions: {
      description: 'Full map of story-file path to version (for bulk change subscriptions).',
      input: noInputSchema,
      output: v.record(v.string(), v.number()),
      handler: (_input, ctx) => ctx.self.state.storyVersions,
    },
  },
  commands: {
    applyGraphSnapshot: {
      description:
        'Internal use only: replaces the reverse index after the initial graph build. Called by the graph engine, not by external consumers.',
      input: v.object({ storiesByFile: storiesByFileSchema }),
      output: v.void(),
      handler: async (input, ctx) => {
        ctx.self.setState((state) => {
          state.ready = true;
          state.storiesByFile = input.storiesByFile;
          state.graphRevision += 1;
        });
      },
    },
    applyGraphUpdate: {
      description:
        'Internal use only: replaces the reverse index after an incremental patch and bumps versions for affected story files. Called by the graph engine, not by external consumers.',
      input: v.object({
        storiesByFile: storiesByFileSchema,
        bumpedStoryFiles: v.array(v.string()),
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
  },
});
