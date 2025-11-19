import type { Documentation } from 'react-docgen';
import * as v from 'valibot';

/**
 * Custom context passed to MCP server and tools.
 * Contains the request object and optional manifest provider.
 */
export interface StorybookContext extends Record<string, unknown> {
	/**
	 * The incoming HTTP request being processed.
	 */
	request?: Request;
	/**
	 * Optional function to provide custom manifest retrieval logic.
	 * If provided, this function will be called instead of the default fetch-based provider.
	 * The function receives the request object and a path to the manifest file,
	 * and should return the manifest as a string.
	 * The default provider requires a request object and constructs the manifest URL from the request origin,
	 * replacing /mcp with /manifests/components.json.
	 * Custom providers can use the request parameter to determine the manifest source, or ignore it entirely.
	 */
	manifestProvider?: (
		request: Request | undefined,
		path: string,
	) => Promise<string>;
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
	 * Receives the context, input parameters, and the found component (if any).
	 */
	onGetComponentDocumentation?: (params: {
		context: StorybookContext;
		input: { componentId: string };
		foundComponent?: ComponentManifest;
	}) => void | Promise<void>;
}

const JSDocTag = v.record(v.string(), v.array(v.string()));

const BaseManifest = v.object({
	name: v.string(),
	description: v.optional(v.string()),
	jsDocTags: v.optional(JSDocTag),
	error: v.optional(
		v.object({
			name: v.string(),
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
	import: v.optional(v.string()),
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
