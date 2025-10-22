import * as v from 'valibot';
import type { Options } from 'storybook/internal/types';

/**
 * Custom context passed to MCP server and tools.
 * Contains Storybook-specific configuration and runtime information.
 */
export interface AddonContext extends Record<string, unknown> {
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
	 * Optional client name for telemetry tracking.
	 */
	client?: string;

	/**
	 * Whether telemetry collection is disabled.
	 */
	disableTelemetry: boolean;
}

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

/**
 * Schema for the output URL array.
 */
export const StoryUrlArray = v.array(v.string());
export type StoryUrlArray = v.InferOutput<typeof StoryUrlArray>;
