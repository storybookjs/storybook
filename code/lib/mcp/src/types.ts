import type { Documentation } from 'react-docgen';
import * as v from 'valibot';

/**
 * Custom context passed to MCP server and tools.
 * Contains the source URL for getting component manifests.
 */
export interface StorybookContext extends Record<string, unknown> {
	/**
	 * The URL of the remote manifest to get component data from.
	 */
	source?: string;
	/**
	 * Optional function to provide custom manifest retrieval logic.
	 * If provided, this function will be called instead of using fetch.
	 * The function receives the source URL and should return the manifest as a string.
	 */
	manifestProvider?: (source: string) => Promise<string>;
	/**
	 * Optional handler called when list-all-components tool is invoked.
	 * Receives the context and the component manifest.
	 */
	onListAllComponents?: (params: {
		context: StorybookContext;
		manifest: ComponentManifestMap;
	}) => void | Promise<void>;
	/**
	 * Optional handler called when get-component-documentation tool is invoked.
	 * Receives the context, input parameters, and the found components.
	 */
	onGetComponentDocumentation?: (params: {
		context: StorybookContext;
		input: { componentIds: string[] };
		foundComponents: ComponentManifest[];
		notFoundIds: string[];
	}) => void | Promise<void>;
}

const JSDocTag = v.record(v.string(), v.array(v.string()));

const BaseManifest = v.object({
	name: v.string(),
	description: v.optional(v.string()),
	import: v.optional(v.string()),
	jsDocTags: v.optional(JSDocTag),
	error: v.optional(
		v.object({
			message: v.string(),
		}),
	),
});

const Story = v.object({
	...BaseManifest.entries,
	snippet: v.optional(v.string()),
});

export const ComponentManifest = v.object({
	...BaseManifest.entries,
	id: v.string(),
	path: v.string(),
	summary: v.optional(v.string()),
	stories: v.optional(v.array(Story)),
	// loose schema for react-docgen types, as they are pretty complex
	reactDocgen: v.optional(v.custom<Documentation>(() => true)),
});
export type ComponentManifest = v.InferOutput<typeof ComponentManifest>;

export const ComponentManifestMap = v.object({
	v: v.number(),
	components: v.record(v.string(), ComponentManifest),
});
export type ComponentManifestMap = v.InferOutput<typeof ComponentManifestMap>;
