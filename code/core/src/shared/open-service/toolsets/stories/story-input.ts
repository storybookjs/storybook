import * as v from 'valibot';

import { toMcpToolName } from '../../toolset-names.ts';

/**
 * Per-shape props/globals selectors, shared by both story selector variants.
 *
 * The prose predates the toolsets and is eval-tuned, so it is kept verbatim. It names sibling
 * capabilities by their MCP tool names rather than through `getToolName`, because valibot descriptions
 * are static strings with no per-consumer rendering. One of them, `get-storybook-story-instructions`,
 * is an `@storybook/addon-mcp` tool with no toolset method;
 * a CLI consumer would need this sentence rewritten rather than re-rendered.
 */
const storyInputProps = {
  props: v.pipe(
    v.optional(v.record(v.string(), v.any())),
    v.description(`Optional custom props to pass to the story for rendering. Use this when you don't want to render the default story,
but you want to customize some args or other props.
You can look up the component's documentation using the get-storybook-story-instructions tool to see what props are available.`)
  ),
  globals: v.pipe(
    v.optional(v.record(v.string(), v.any())),
    v.description(`Optional Storybook globals to set for the story preview. Globals are used for things like theme, locale, viewport, and other cross-cutting concerns.
Common globals include 'theme' (e.g., 'dark', 'light'), 'locale' (e.g., 'en', 'fr'), and 'backgrounds' (e.g., { value: '#000' }).`)
  ),
};

/**
 * Shared story selector used by the stories and test APIs.
 *
 * Prefer `{ storyId }` unless the caller already has a concrete story-file path and export name.
 */
export const storyInputSchema = v.union([
  v.object({
    exportName: v.pipe(
      v.string(),
      v.description(
        `The export name of the story from the story file.
Use this path-based shape only when you're already editing a .stories.* file and know the export names in that file.
If you do not already have story file context, prefer the storyId shape instead of searching files.`
      )
    ),
    explicitStoryName: v.pipe(
      v.optional(v.string()),
      v.description(
        `If the story has an explicit name set via the "name" property, that is different from the export name, provide it here.
Otherwise don't set this.`
      )
    ),
    absoluteStoryPath: v.pipe(
      v.string(),
      v.description(
        'Absolute path to the story file. Use together with exportName only when story file context is already available.'
      )
    ),
    ...storyInputProps,
  }),
  v.object({
    storyId: v.pipe(
      v.string(),
      v.description(
        `The full Storybook story ID (for example "button--primary").
Prefer this shape whenever you are not already working in a specific story file.
Use IDs discovered from ${toMcpToolName('docs.list')} (withStoryIds=true) or ${toMcpToolName('docs.show')}.`
      )
    ),
    ...storyInputProps,
  }),
]);

export const storyInputArraySchema = v.array(storyInputSchema);

export type StoryInput = v.InferOutput<typeof storyInputSchema>;
