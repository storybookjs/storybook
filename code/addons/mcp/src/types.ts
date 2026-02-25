import * as v from 'valibot';
import type { Options } from 'storybook/internal/types';
import { GET_TOOL_NAME, LIST_TOOL_NAME, type StorybookContext } from '@storybook/mcp';
import { GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME } from './tools/tool-names.ts';

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

	/**
	 * Whether @storybook/addon-a11y is enabled.
	 * Used to dynamically tailor tool descriptions and guidance.
	 */
	a11yEnabled?: boolean;

	toolsets?: NonNullable<AddonOptionsOutput>['toolsets'];
};

const StoryInputProps = {
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
};

/**
 * Schema for a single story input when requesting story URLs.
 */
export const StoryInput = v.union([
	v.object({
		/**
		 * The export name of the story from the story file.
		 * Example: "Primary", "WithArgs", "Default"
		 */
		exportName: v.pipe(
			v.string(),
			v.description(
				`The export name of the story from the story file.
Use this path-based shape only when you're already editing a .stories.* file and know the export names in that file.
If you do not already have story file context, prefer the storyId shape instead of searching files.`,
			),
		),

		/**
		 * Optional explicit story name if different from the export name.
		 * This is used when a story has a custom name defined.
		 */
		explicitStoryName: v.pipe(
			v.optional(v.string()),
			v.description(
				`If the story has an explicit name set via the "name" property, that is different from the export name, provide it here.
Otherwise don't set this.`,
			),
		),

		/**
		 * Absolute file path to the story file.
		 */
		absoluteStoryPath: v.pipe(
			v.string(),
			v.description(
				'Absolute path to the story file. Use together with exportName only when story file context is already available.',
			),
		),

		...StoryInputProps,
	}),
	v.object({
		storyId: v.pipe(
			v.string(),
			v.description(
				`The full Storybook story ID (for example "button--primary").
Prefer this shape whenever you are not already working in a specific story file.
Use IDs discovered from ${LIST_TOOL_NAME} (withStoryIds=true) or ${GET_TOOL_NAME}.`,
			),
		),

		...StoryInputProps,
	}),
]);
export type StoryInput = v.InferOutput<typeof StoryInput>;

/**
 * Schema for the array of stories to fetch URLs for.
 */
export const StoryInputArray = v.array(StoryInput);
export type StoryInputArray = v.InferOutput<typeof StoryInputArray>;
