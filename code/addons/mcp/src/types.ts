import * as v from 'valibot';
import type { Options } from 'storybook/internal/types';
import type { StorybookContext } from '@storybook/mcp';
import { GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME } from './tools/get-storybook-story-instructions';

export const AddonOptions = v.object({
	toolsets: v.optional(
		v.object({
			dev: v.exactOptional(v.boolean(), true),
			docs: v.exactOptional(v.boolean(), true),
			test: v.exactOptional(v.boolean(), true),
		}),
		{
			// Default values for toolsets
			dev: true,
			docs: true,
			test: true,
		},
	),
	experimentalFormat: v.optional(v.picklist(['xml', 'markdown']), 'markdown'),
});

export type AddonOptionsInput = v.InferInput<typeof AddonOptions>;
export type AddonOptionsOutput = v.InferOutput<typeof AddonOptions>;
/**
 * Custom context passed to MCP server and tools.
 * Contains Storybook-specific configuration and runtime information.
 * Extends StorybookContext to be compatible with @storybook/mcp tools.
 */
export type AddonContext = StorybookContext & {
	/**
	 * The Storybook options object containing configuration,
	 * port, presets, and other runtime information.
	 */
	options: Options;

	/**
	 * The origin URL of the running Storybook instance.
	 * Typically http://localhost:{port}
	 */
	origin: string;

	/**
	 * Whether telemetry collection is disabled.
	 */
	disableTelemetry: boolean;

	toolsets?: NonNullable<AddonOptionsOutput>['toolsets'];
};

/**
 * Schema for a single story input when requesting story URLs.
 */
export const StoryInput = v.object({
	/**
	 * The export name of the story from the story file.
	 * Example: "Primary", "WithArgs", "Default"
	 */
	exportName: v.string(),

	/**
	 * Optional explicit story name if different from the export name.
	 * This is used when a story has a custom name defined.
	 */
	explicitStoryName: v.pipe(
		v.optional(v.string()),
		v.description(
			`If the story has an explicit name set via the "name" propoerty, that is different from the export name, provide it here.
Otherwise don't set this.`,
		),
	),

	/**
	 * Absolute file path to the story file.
	 */
	absoluteStoryPath: v.string(),

	/**
	 * Optional props to pass to the story.
	 */
	props: v.pipe(
		v.optional(v.record(v.string(), v.any())),
		v.description(`Optional custom props to pass to the story for rendering. Use this when you don't want to render the default story,
but you want to customize some args or other props.
You can look up the component's documentation using the ${GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME} tool to see what props are available.`),
	),

	/**
	 * Optional globals to set for the story.
	 */
	globals: v.pipe(
		v.optional(v.record(v.string(), v.any())),
		v.description(`Optional Storybook globals to set for the story preview. Globals are used for things like theme, locale, viewport, and other cross-cutting concerns.
Common globals include 'theme' (e.g., 'dark', 'light'), 'locale' (e.g., 'en', 'fr'), and 'backgrounds' (e.g., { value: '#000' }).`),
	),
});
export type StoryInput = v.InferOutput<typeof StoryInput>;

/**
 * Schema for the array of stories to fetch URLs for.
 */
export const StoryInputArray = v.array(StoryInput);
export type StoryInputArray = v.InferOutput<typeof StoryInputArray>;
