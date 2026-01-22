import * as v from 'valibot';
import type { Options } from 'storybook/internal/types';
import type { StorybookContext } from '@storybook/mcp';

export const AddonOptions = v.object({
	toolsets: v.optional(
		v.object({
			dev: v.exactOptional(v.boolean(), true),
			docs: v.exactOptional(v.boolean(), true),
		}),
		{
			// Default values for toolsets
			dev: true,
			docs: true,
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
	explicitStoryName: v.optional(v.string()),

	/**
	 * Absolute file path to the story file.
	 */
	absoluteStoryPath: v.string(),
});
export type StoryInput = v.InferOutput<typeof StoryInput>;

/**
 * Schema for the array of stories to fetch URLs for.
 */
export const StoryInputArray = v.array(StoryInput);
export type StoryInputArray = v.InferOutput<typeof StoryInputArray>;
