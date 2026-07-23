import type { StoryIndex } from 'storybook/internal/types';

import * as v from 'valibot';

import { OpenServiceMissingOriginError } from '../../../../server-errors.ts';
import type { StatusesByStoryIdAndTypeId } from '../../../status-store/index.ts';
import { defineApi } from '../../../public-api/index.ts';
import { getChangedStories } from './changed.ts';
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

export type CreateStoriesApiOptions = {
  getIndex: () => Promise<StoryIndex>;
  getOrigin: () => string;
  getChangeStatuses: () => Promise<StatusesByStoryIdAndTypeId>;
  detectUnreachableFiles: () => Promise<string[]>;
  findStoriesByComponent: (
    componentPaths: string[],
    maxDistance?: number
  ) => Promise<FindByComponentOutput>;
};

const jsonSchema = v.optional(
  v.pipe(v.boolean(), v.description('When true, return structured JSON instead of Markdown.')),
  false
);

/** Creates the public stories API with request-local access to Storybook runtime dependencies. */
export function createStoriesApi({
  getIndex,
  getOrigin,
  getChangeStatuses,
  detectUnreachableFiles,
  findStoriesByComponent,
}: CreateStoriesApiOptions) {
  return defineApi({
    id: 'stories',
    description: 'Story discovery, change detection, and preview URL generation.',
    methods: {
      preview: {
        schema: v.object({
          stories: v.pipe(
            storyInputArraySchema,
            v.description('Stories to preview. Prefer { storyId } when available.')
          ),
          json: jsonSchema,
        }),
        description: 'Resolves story selectors to preview URLs.',
        handler: async (input) => {
          const origin = getOrigin();
          if (!origin) {
            throw new OpenServiceMissingOriginError({
              serviceId: 'stories',
              operationName: 'preview',
            });
          }
          const data = previewStories({ origin, index: await getIndex(), stories: input.stories });
          return input.json ? data : formatPreviewStories(data);
        },
      },
      changed: {
        schema: v.object({ json: jsonSchema }),
        description:
          'Returns new, modified, and related stories from change detection, plus unreachable working-tree files.',
        handler: async (input) => {
          const [statuses, index, unreachableFiles] = await Promise.all([
            getChangeStatuses(),
            getIndex(),
            detectUnreachableFiles(),
          ]);
          const data = getChangedStories({ statuses, index, unreachableFiles });
          return input.json ? data : formatChangedStories(data);
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
          json: jsonSchema,
        }),
        description: 'Finds stories that import the given component paths via the module graph.',
        handler: async (input) => {
          const data = await findStoriesByComponent(input.componentPaths, input.maxDistance);
          return input.json ? data : formatFindByComponent(data);
        },
      },
    },
  });
}

export type StoriesApi = ReturnType<typeof createStoriesApi>;
