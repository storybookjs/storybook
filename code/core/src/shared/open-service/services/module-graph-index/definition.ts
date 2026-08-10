import * as v from 'valibot';

import { defineService } from '../../service-definition.ts';
import type { ServiceInstanceOf } from '../../types.ts';
import type { ModuleGraphIndexServiceState, StoriesByFileRecord } from '../module-graph/types.ts';
import { toStoryIndexPath } from '../module-graph/types.ts';

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

export type { ModuleGraphIndexServiceState } from '../module-graph/types.ts';

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
    _storiesForFiles: {
      internal: true,
      description:
        'Internal lookup used by `core/module-graph.storiesForFiles`. Prefer the hot service query from consumers.',
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
  },
  commands: {
    _applyIndex: {
      internal: true,
      description:
        'Replaces the reverse index. Called by `core/module-graph` snapshot/update commands when the index moved.',
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
          state.storiesByFile = input.storiesByFile as StoriesByFileRecord;
        });
      },
    },
  },
});

export type ModuleGraphIndexService = ServiceInstanceOf<typeof moduleGraphIndexServiceDef>;
