import * as v from 'valibot';

/**
 * Shared story selector used by `core/stories` and `core/test`.
 *
 * Prefer `{ storyId }` unless the caller already has a concrete story-file path and export name.
 */
export const storyInputSchema = v.union([
  v.object({
    exportName: v.pipe(
      v.string(),
      v.description('Export name of the story from the story file (for example "Primary").')
    ),
    explicitStoryName: v.pipe(
      v.optional(v.string()),
      v.description('Story `name` when it differs from the export name.')
    ),
    absoluteStoryPath: v.pipe(
      v.string(),
      v.description('Absolute path to the story file, used with exportName.')
    ),
    props: v.pipe(
      v.optional(v.record(v.string(), v.any())),
      v.description('Optional story args/props overrides.')
    ),
    globals: v.pipe(
      v.optional(v.record(v.string(), v.any())),
      v.description('Optional Storybook globals (theme, locale, viewport, …).')
    ),
  }),
  v.object({
    storyId: v.pipe(
      v.string(),
      v.description('Full Storybook story id (for example "button--primary").')
    ),
    props: v.pipe(
      v.optional(v.record(v.string(), v.any())),
      v.description('Optional story args/props overrides.')
    ),
    globals: v.pipe(
      v.optional(v.record(v.string(), v.any())),
      v.description('Optional Storybook globals (theme, locale, viewport, …).')
    ),
  }),
]);

export const storyInputArraySchema = v.array(storyInputSchema);

export type StoryInput = v.InferOutput<typeof storyInputSchema>;
