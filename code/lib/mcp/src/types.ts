import type { Documentation } from 'react-docgen/dist/Documentation';
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
}

const JSDocTag = v.record(v.string(), v.array(v.string()));

const BaseManifest = v.object({
	name: v.string(),
	description: v.exactOptional(v.string()),
	import: v.exactOptional(v.string()),
	jsDocTags: v.exactOptional(JSDocTag),
});

const Example = v.object({
	...BaseManifest.entries,
	snippet: v.string(),
});

export const ComponentManifest = v.object({
	...BaseManifest.entries,
	id: v.string(),
	summary: v.exactOptional(v.string()),
	examples: v.exactOptional(v.array(Example)),
	// loose schema for react-docgen types, as they are pretty complex
	reactDocgen: v.exactOptional(v.custom<Documentation>(() => true)),
});
export type ComponentManifest = v.InferOutput<typeof ComponentManifest>;

export const ComponentManifestMap = v.object({
	v: v.number(),
	components: v.record(v.string(), ComponentManifest),
});
export type ComponentManifestMap = v.InferOutput<typeof ComponentManifestMap>;
