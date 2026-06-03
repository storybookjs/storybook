import * as v from 'valibot';
import { normalize } from 'pathe';

import { defineService } from '../../service-definition.ts';
import type { ModuleGraphServiceState, StoriesByFileRecord } from './types.ts';

const storyDepthSchema = v.object({
  storyFile: v.string(),
  depth: v.number(),
});

const filesInputSchema = v.object({
  files: v.array(v.string()),
});

const storyFileInputSchema = v.object({
  storyFile: v.string(),
});

const storiesByFileSchema = v.record(v.string(), v.record(v.string(), v.number()));

const snapshotInputSchema = v.object({
  storiesByFile: storiesByFileSchema,
});

const updateInputSchema = v.object({
  storiesByFile: storiesByFileSchema,
  bumpedStoryFiles: v.array(v.string()),
});

/** Queries with no caller input — only `undefined` is accepted. */
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
  } satisfies ModuleGraphServiceState,
  queries: {
    getStoriesForFiles: {
      description:
        'Returns, for each input file (same order), story files that depend on it and their BFS depths.',
      input: filesInputSchema,
      output: v.array(v.array(storyDepthSchema)),
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
      input: storyFileInputSchema,
      output: v.number(),
      handler: (input, ctx) => ctx.self.state.storyVersions[normalize(input.storyFile)] ?? 0,
    },
    getAllStoryVersions: {
      description: 'Full map of story-file path to version (for bulk change subscriptions).',
      input: noInputSchema,
      output: v.record(v.string(), v.number()),
      handler: (_input, ctx) => ({ ...ctx.self.state.storyVersions }),
    },
  },
  commands: {
    applyGraphSnapshot: {
      description: 'Replaces the reverse index after the initial graph build.',
      input: snapshotInputSchema,
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
        'Replaces the reverse index after an incremental patch and bumps versions for affected story files.',
      input: updateInputSchema,
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
