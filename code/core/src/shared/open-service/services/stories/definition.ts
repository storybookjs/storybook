import * as v from 'valibot';

import { defineService } from '../../service-definition.ts';
import type { ServiceInstanceOf } from '../../types.ts';
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

const changeStatusSchema = v.union([
  v.literal('status-value:new'),
  v.literal('status-value:modified'),
  v.literal('status-value:affected'),
]);

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

export type StoriesServiceState = Record<string, never>;

/**
 * Story discovery and preview URLs (`stories.preview` / `stories.changed` / `stories.findByComponent`).
 *
 * These are commands because each call performs live async work against injected runtime
 * dependencies (story index, status store, git/filesystem, module graph, server origin).
 */
export const storiesServiceDef = defineService({
  id: 'core/stories',
  description: 'Story discovery, change detection, and preview URL generation.',
  initialState: {} as StoriesServiceState,
  queries: {},
  commands: {
    preview: {
      description: 'Resolves story selectors to preview URLs.',
      input: v.object({
        stories: v.pipe(
          storyInputArraySchema,
          v.description('Stories to preview. Prefer { storyId } when available.')
        ),
      }),
      output: previewOutputSchema,
    },
    changed: {
      description:
        'Returns new, modified, and related stories from change detection, plus unreachable working-tree files.',
      input: v.undefined(),
      output: changedOutputSchema,
    },
    findByComponent: {
      description: 'Finds stories that import the given component paths via the module graph.',
      input: v.object({
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
      output: findByComponentOutputSchema,
    },
  },
});

export type StoriesService = ServiceInstanceOf<typeof storiesServiceDef>;
