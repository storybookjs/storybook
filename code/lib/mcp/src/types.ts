import type { Documentation } from 'react-docgen';
import type { ComponentDoc } from 'react-docgen-typescript';
import * as v from 'valibot';

/**
 * Represents a single Storybook source (local or remote).
 */
export type Source = {
	/** Unique identifier for this source (e.g., 'local', 'tetra') */
	id: string;
	/** Human-readable title (e.g., 'Local', 'Tetra Design System') */
	title: string;
	/** Remote URL, undefined for local source */
	url?: string;
};

/**
 * All manifests for a single source.
 */
export type SourceManifests = {
	source: Source;
	componentManifest: ComponentManifestMap;
	docsManifest?: DocsManifestMap;
	/** Error message if fetching this source failed */
	error?: string;
};

/**
 * Custom context passed to MCP server and tools.
 * Contains the request object and optional manifest provider.
 */
export type StorybookContext = {
	/**
	 * The incoming HTTP request being processed.
	 */
	request?: Request;
	/**
	 * Optional function to provide custom manifest retrieval logic.
	 * If provided, this function will be called instead of the default fetch-based provider.
	 * The function receives the request object, a path to the manifest file, and optionally
	 * a source (in multi-source mode).
	 * The default provider requires a request object and constructs the manifest URL from the request origin,
	 * replacing /mcp with /manifests/components.json.
	 * Custom providers can use the request parameter to determine the manifest source, or ignore it entirely.
	 */
	manifestProvider?: (
		request: Request | undefined,
		path: string,
		source?: Source,
	) => Promise<string>;
	/**
	 * Sources configuration for multi-source mode.
	 * When provided, tools will fetch and display manifests grouped by source.
	 */
	sources?: Source[];
	/**
	 * Optional handler called when list-all-documentation tool is invoked.
	 * Receives the context and the component manifest.
	 */
	onListAllDocumentation?: (params: {
		context: StorybookContext;
		manifests: AllManifests;
		resultText: string;
		/** Present in multi-source mode — all source manifests including errors */
		sources?: SourceManifests[];
	}) => void | Promise<void>;
	/**
	 * Optional handler called when get-documentation tool is invoked.
	 * Receives the context, input parameters, and the found component (if any).
	 */
	onGetDocumentation?: (
		params: {
			context: StorybookContext;
			input: { id: string; storybookId?: string };
		} & (
			| { foundDocumentation: ComponentManifest | Doc; resultText: string }
			| { foundDocumentation?: never; resultText?: never }
		),
	) => void | Promise<void>;
};

const JSDocTag = v.record(v.string(), v.array(v.string()));

const Error = v.object({
	name: v.string(),
	message: v.string(),
});

const BaseManifest = v.object({
	name: v.string(),
	description: v.optional(v.string()),
	jsDocTags: v.optional(JSDocTag),
	error: v.optional(Error),
});

const Story = v.object({
	...BaseManifest.entries,
	id: v.optional(v.string()),
	snippet: v.optional(v.string()),
	summary: v.optional(v.string()),
});
export type Story = v.InferOutput<typeof Story>;

/**
 * A docs entry represents MDX documentation that can be attached to a component
 * or standalone (unattached).
 */
const Doc = v.object({
	id: v.string(),
	name: v.string(),
	title: v.string(),
	path: v.string(),
	content: v.string(),
	summary: v.optional(v.string()),
	error: v.optional(Error),
});
export type Doc = v.InferOutput<typeof Doc>;

/**
 * Component documentation from react-docgen-typescript, extended with export name.
 * Matches the shape produced by Storybook's manifest generator.
 */
export type ComponentDocWithExportName = ComponentDoc & { exportName: string };

export const ComponentManifest = v.object({
	...BaseManifest.entries,
	id: v.string(),
	path: v.string(),
	summary: v.optional(v.string()),
	import: v.optional(v.string()),
	stories: v.optional(v.array(Story)),
	// loose schema for react-docgen types, as they are pretty complex
	reactDocgen: v.optional(v.any()),
	// loose schema for react-docgen-typescript types
	reactDocgenTypescript: v.optional(v.any()),
	docs: v.optional(v.record(v.string(), Doc)),
});
export type ComponentManifest = v.InferOutput<typeof ComponentManifest>;

export const ComponentManifestMap = v.object({
	v: v.number(),
	components: v.record(v.string(), ComponentManifest),
});
export type ComponentManifestMap = v.InferOutput<typeof ComponentManifestMap>;

/**
 * Manifest for unattached/standalone documentation entries.
 * Served at /manifests/docs.json
 */
export const DocsManifestMap = v.object({
	v: v.number(),
	docs: v.record(v.string(), Doc),
});
export type DocsManifestMap = v.InferOutput<typeof DocsManifestMap>;

export type AllManifests = {
	componentManifest: ComponentManifestMap;
	docsManifest?: DocsManifestMap;
};
