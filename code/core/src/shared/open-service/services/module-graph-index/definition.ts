import * as v from 'valibot';

import { defineService } from '../../service-definition.ts';
import type { ServiceInstanceOf } from '../../types.ts';
import type { ModuleGraphService } from '../module-graph/definition.ts';
import {
  storiesByFileSchema,
  storiesForFilesInputSchema,
  storiesForFilesOutputSchema,
} from '../module-graph/schemas.ts';
import { toStoryIndexPath } from '../module-graph/types.ts';
import type { ModuleGraphIndexServiceState } from './types.ts';

export type { ModuleGraphIndexServiceState } from './types.ts';

export const moduleGraphIndexServiceDef = defineService({
  id: 'core/module-graph-index',
  internal: true,
  description:
    'Reverse index from source files to story files. Paired with `core/module-graph` (revisions/status); updated only when the index structure moves, not on bump-only patches.',
  initialState: {
    workingDir: process.cwd(),
    storiesByFile: {},
  } as ModuleGraphIndexServiceState,
  queries: {
    storiesForFiles: {
      description:
        'Returns, for each input file (same order), story-index-relative story files that depend on it and their breadth-first-search depth: the shortest number of import edges between the input file and the story file.',
      input: storiesForFilesInputSchema,
      output: storiesForFilesOutputSchema,
      load: async (_input, ctx) => {
        // Drain the hot engine's patch queue so lookups never observe a mid-patch empty index.
        const moduleGraph = ctx.getService<ModuleGraphService>('core/module-graph', {
          internal: true,
        });
        await moduleGraph.commands._waitForSettledEngine(undefined);
      },
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
  },
  commands: {
    _applyIndex: {
      internal: true,
      description:
        'Replaces the reverse index. Called when the engine mirrors a new index (snapshot or index-moving patch).',
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
          state.storiesByFile = input.storiesByFile;
        });
      },
    },
  },
});

export type ModuleGraphIndexService = ServiceInstanceOf<typeof moduleGraphIndexServiceDef>;
