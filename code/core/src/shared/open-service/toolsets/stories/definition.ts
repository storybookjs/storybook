import type { StoryIndex } from 'storybook/internal/types';

import { resolve as resolvePath } from 'pathe';
import * as v from 'valibot';

import { OpenServiceMissingOriginError } from '../../../../server-errors.ts';
import type { ModuleGraphService } from '../../services/module-graph/definition.ts';
import { defineToolset } from '../../toolset-definition.ts';
import type { StatusesByStoryIdAndTypeId } from '../../../status-store/index.ts';
import { getChangedStories } from './changed.ts';
import { findStoriesByComponent } from './find-by-component.ts';
import { formatChangedStories, formatFindByComponent, formatPreviewStories } from './format.ts';
import { previewStories } from './preview-stories.ts';
import { storyInputArraySchema, storyInputSchema } from './story-input.ts';

const previewSuccessSchema = v.object({
  title: v.string(),
  name: v.string(),
  previewUrl: v.pipe(v.string(), v.description('Direct URL for the story preview.')),
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
      'Import-graph depth from the story file to the component. 0 = path is a story file; 1 = direct import; 2+ = transitive.'
    )
  ),
});

const findByComponentOutputSchema = v.object({
  results: v.array(
    v.object({
      componentPath: v.string(),
      matches: v.array(storyMatchSchema),
      clipped: v.optional(
        v.object({
          count: v.number(),
          distances: v.array(v.number()),
        })
      ),
      pathNotFound: v.optional(v.boolean()),
    })
  ),
});

export type FindByComponentOutput = v.InferOutput<typeof findByComponentOutputSchema>;

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
};

/** Creates the public stories API with request-local access to Storybook runtime dependencies. */
export function createStoriesToolset({
  storyIndex,
  git,
  changeStatuses,
}: CreateStoriesToolsetOptions) {
  return defineToolset({
    id: 'stories',
    description: 'Story discovery, change detection, and preview URL generation.',
    methods: {
      preview: {
        schema: v.object({
          stories: v.pipe(
            storyInputArraySchema,
            v.description('Stories to preview. Prefer { storyId } when available.')
          ),
        }),
        description: 'Resolves story selectors to preview URLs.',
        handler: async (input, ctx) => {
          const origin = ctx.origin;
          if (!origin) {
            throw new OpenServiceMissingOriginError({
              toolsetId: 'stories',
              methodName: 'preview',
            });
          }
          const data = previewStories({
            origin,
            index: await storyIndex.getIndex(),
            stories: input.stories,
          });
          return ctx.format === 'json' ? data : formatPreviewStories(data);
        },
      },
      changed: {
        schema: v.object({}),
        description:
          'Returns new, modified, and related stories from change detection, plus unreachable working-tree files.',
        handler: async (input, ctx) => {
          const moduleGraph = ctx.getService<ModuleGraphService>('core/module-graph', {
            internal: true,
          });
          const [statuses, index, changedFiles, repoRoot] = await Promise.all([
            Promise.resolve(changeStatuses.getAll()),
            storyIndex.getIndex(),
            git.getChangedFiles(),
            git.getRepoRoot(),
          ]);
          const files = [...new Set([...changedFiles.changed, ...changedFiles.new])].map((file) =>
            resolvePath(repoRoot, file)
          );
          let unreachableFiles: string[] = [];
          const status = await moduleGraph.queries.status.loaded(undefined);
          if (status.value === 'ready') {
            const storiesForFiles = await moduleGraph.queries.storiesForFiles.loaded({ files });
            unreachableFiles = files.filter(
              (_file, fileIndex) => storiesForFiles[fileIndex]?.length === 0
            );
          }
          const data = {
            ...getChangedStories({ statuses, index }),
            unreachableFiles,
          };
          return ctx.format === 'json' ? data : formatChangedStories(data);
        },
      },
      findByComponent: {
        schema: v.object({
          componentPaths: v.pipe(
            v.array(v.string()),
            v.minLength(1),
            v.description('Component file paths (absolute preferred).')
          ),
          maxDistance: v.pipe(
            v.optional(v.pipe(v.number(), v.minValue(1), v.integer())),
            v.description('Maximum import-graph distance to include. Defaults to 3.')
          ),
        }),
        description: 'Finds stories that import the given component paths via the module graph.',
        handler: async (input, ctx) => {
          const moduleGraph = ctx.getService<ModuleGraphService>('core/module-graph', {
            internal: true,
          });
          const index = await storyIndex.getIndex();
          const data = await findStoriesByComponent({
            componentPaths: input.componentPaths,
            maxDistance: input.maxDistance,
            index,
            moduleGraph,
          });
          return ctx.format === 'json' ? data : formatFindByComponent(data);
        },
      },
    },
  });
}

export type StoriesToolset = ReturnType<typeof createStoriesToolset>;
