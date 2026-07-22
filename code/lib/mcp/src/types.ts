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

export type RequiresOwnMcpNotice = {
	kind: 'requires-own-mcp';
	endpoint: string;
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
	/** Non-error guidance for sources that must be accessed through their own MCP endpoint */
	notice?: RequiresOwnMcpNotice;
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
	 * using the top-level manifest path such as /manifests/components.json.
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
	/**
	 * Optional in-process resolver for a single component or docs entry, used in
	 * Storybook's dev server when `experimentalDocgenServer` is enabled. When set,
	 * single-entry tools (`get-documentation`, `get-documentation-for-story`) call
	 * this instead of fetching the (potentially all-component) manifest index, so a
	 * single lookup never triggers docgen extraction for every component.
	 *
	 * Returns the fully-resolved component or doc in `@storybook/mcp`'s internal
	 * shape (already adapted from the open-service payloads), or `undefined` when the
	 * id is unknown.
	 */
	resolveEntry?: (id: string, source?: Source) => Promise<ResolvedEntry | undefined>;
};

/**
 * Result of resolving a single id via {@link StorybookContext.resolveEntry}: either a
 * fully-resolved component manifest or a standalone docs entry.
 */
export type ResolvedEntry =
	| { kind: 'component'; component: ComponentManifest }
	| { kind: 'doc'; doc: Doc };

const JSDocTag = v.record(v.string(), v.array(v.string()));

const ManifestError = v.object({
	name: v.string(),
	message: v.string(),
});

const BaseManifest = v.object({
	name: v.string(),
	description: v.optional(v.string()),
	jsDocTags: v.optional(JSDocTag),
	error: v.optional(ManifestError),
});

const Story = v.object({
	...BaseManifest.entries,
	id: v.optional(v.string()),
	snippet: v.optional(v.string()),
	summary: v.optional(v.string()),
});
export type Story = v.InferOutput<typeof Story>;

/**
 * A JSON Reference (`{ $ref }`) pointing at a value in another manifest document.
 * Used by the v1 (split/ref) manifest format for docgen, story-docs and MDX payloads.
 */
export const JsonRef = v.object({
	$ref: v.string(),
});
export type JsonRef = v.InferOutput<typeof JsonRef>;

/**
 * Component documentation from react-docgen-typescript, extended with export name.
 * Matches the shape produced by Storybook's manifest generator.
 */
export type ComponentDocWithExportName = ComponentDoc & { exportName: string };

// ---------------------------------------------------------------------------
// Manifest formats
//
// Storybook writes one of two manifest formats, distinguished by the top-level
// `v` field on `components.json` / `docs.json` (see Storybook core:
// `renderers/react/.../componentManifest/generator.ts` emits `v: 0`,
// `core-server/.../components-ref-manifest.ts` emits `v: 1`):
//
//   • v0 — inline/legacy: every component carries its docgen, stories array and
//     attached docs (with MDX `content`) inline.
//   • v1 — split/ref: `components.json`/`docs.json` are shallow indexes; the heavy
//     docgen, story-docs and MDX payloads live in sibling `services/*.json` files
//     and are referenced via `$ref`. (Storybook's in-process dev provider emits an
//     even shallower v1 index — `docgen`/`mdx` refs omitted — because single
//     entries are resolved in-process instead, see `StorybookContext.resolveEntry`.)
//
// The two formats are kept as separate schemas so each version's exact shape is
// explicit, then combined into a `v`-discriminated union at the map level. Anything
// that needs to branch on the version can read `map.v` or match the per-version
// schemas directly.
// ---------------------------------------------------------------------------

// ---- v0: inline / legacy ----

/** Inline (v0) docs entry: the full MDX `content` is embedded. */
export const DocV0 = v.object({
	id: v.string(),
	name: v.string(),
	title: v.optional(v.string()),
	path: v.optional(v.string()),
	content: v.optional(v.string()),
	summary: v.optional(v.string()),
	error: v.optional(ManifestError),
});
export type DocV0 = v.InferOutput<typeof DocV0>;

const BaseInlineComponentProperties = v.object({
	...BaseManifest.entries,
	path: v.optional(v.string()),
	summary: v.optional(v.string()),
	import: v.optional(v.string()),
	reactDocgen: v.optional(v.any()),
	reactDocgenTypescript: v.optional(v.any()),
	reactComponentMeta: v.optional(v.any()),
});

export const SubcomponentManifest = v.object({
	...BaseInlineComponentProperties.entries,
});
export type SubcomponentManifest = v.InferOutput<typeof SubcomponentManifest>;

/** Inline (v0) component: docgen, stories and attached docs are all embedded. */
export const ComponentManifestV0 = v.object({
	...BaseInlineComponentProperties.entries,
	id: v.string(),
	stories: v.optional(v.array(Story)),
	subcomponents: v.optional(v.record(v.string(), SubcomponentManifest)),
	docs: v.optional(v.record(v.string(), DocV0)),
});
export type ComponentManifestV0 = v.InferOutput<typeof ComponentManifestV0>;

export const ComponentManifestMapV0 = v.object({
	v: v.literal(0),
	components: v.record(v.string(), ComponentManifestV0),
});
export type ComponentManifestMapV0 = v.InferOutput<typeof ComponentManifestMapV0>;

export const DocsManifestMapV0 = v.object({
	v: v.literal(0),
	docs: v.record(v.string(), DocV0),
});
export type DocsManifestMapV0 = v.InferOutput<typeof DocsManifestMapV0>;

// ---- v1: split / ref ----

/**
 * Shallow (v1) docs entry. The full MDX payload (title/path/content) lives behind
 * `mdx.$ref`; `mdx` is optional because Storybook's in-process dev index omits it
 * (those entries are resolved in-process via {@link StorybookContext.resolveEntry}).
 */
export const DocV1 = v.object({
	id: v.string(),
	name: v.string(),
	summary: v.optional(v.string()),
	mdx: v.optional(JsonRef),
	error: v.optional(ManifestError),
});
export type DocV1 = v.InferOutput<typeof DocV1>;

/**
 * Shallow (v1) component index row. Identity + summary are inlined for cheap
 * listing; docgen and story-docs live behind `$ref`s, attached docs behind nested
 * `mdx.$ref`s. `docgen`/`stories` are optional (the in-process dev index omits
 * `docgen`, and docs-only components have neither).
 */
export const ComponentManifestV1 = v.object({
	id: v.string(),
	name: v.string(),
	description: v.optional(v.string()),
	summary: v.optional(v.string()),
	error: v.optional(ManifestError),
	docgen: v.optional(JsonRef),
	stories: v.optional(JsonRef),
	docs: v.optional(v.record(v.string(), DocV1)),
});
export type ComponentManifestV1 = v.InferOutput<typeof ComponentManifestV1>;

export const ComponentManifestMapV1 = v.object({
	v: v.literal(1),
	components: v.record(v.string(), ComponentManifestV1),
});
export type ComponentManifestMapV1 = v.InferOutput<typeof ComponentManifestMapV1>;

export const DocsManifestMapV1 = v.object({
	v: v.literal(1),
	docs: v.record(v.string(), DocV1),
});
export type DocsManifestMapV1 = v.InferOutput<typeof DocsManifestMapV1>;

// ---- discriminated unions (the wire schema for top-level manifests) ----

/** `components.json`, discriminated on `v` (0 = inline, 1 = split/ref). */
export const ComponentManifestMap = v.variant('v', [
	ComponentManifestMapV0,
	ComponentManifestMapV1,
]);
export type ComponentManifestMap = v.InferOutput<typeof ComponentManifestMap>;

/**
 * `docs.json` for unattached/standalone documentation entries (served at
 * `/manifests/docs.json`), discriminated on `v`.
 */
export const DocsManifestMap = v.variant('v', [DocsManifestMapV0, DocsManifestMapV1]);
export type DocsManifestMap = v.InferOutput<typeof DocsManifestMap>;

// ---- working / resolved types ----

/**
 * A component index row as it appears in either format: inline (v0) or shallow
 * ref (v1). This is what {@link resolveComponentEntry} consumes before following any
 * `$ref`s.
 */
export type ComponentManifestEntry = ComponentManifestV0 | ComponentManifestV1;

/** A docs index row as it appears in either format: inline (v0) or shallow ref (v1). */
export type DocEntry = DocV0 | DocV1;

/**
 * A fully-resolved component, as consumed by the tools and formatters: inline shape
 * (stories as an array, attached docs with `content`, docgen inlined). Identical to
 * the v0 shape — v1 rows are resolved into it by following their `$ref`s
 * (`resolveComponentEntry`) or built in-process (`adaptCoreComponent`).
 */
export type ComponentManifest = ComponentManifestV0;

/** A fully-resolved docs entry (inline `content`), as consumed by tools and formatters. */
export type Doc = DocV0;

export type AllManifests = {
	componentManifest: ComponentManifestMap;
	docsManifest?: DocsManifestMap;
};

/**
 * Open-service payload contracts (the "core format") that Storybook's
 * `experimentalDocgenServer` mode produces. `@storybook/mcp` adapts these into its
 * internal {@link ComponentManifest}/{@link Doc} shapes in one place
 * (`adaptCoreComponent`/`adaptCoreDoc`). Defined structurally (not as schemas) so
 * the addon can build them in-process without importing Storybook core.
 */

/** One story snippet from the `core/story-docs` service. */
export type CoreStoryDoc = {
	id: string;
	name: string;
	snippet?: string;
	description?: string;
	summary?: string;
	error?: { name: string; message: string };
};

/** One MDX doc from the `addon-docs/mdx` service. */
export type CoreMdxDoc = {
	id: string;
	name: string;
	path?: string;
	title?: string;
	content?: string;
	summary?: string;
	error?: { name: string; message: string };
};

/**
 * Payload returned by the `addon-docs/mdx` service for a component or standalone
 * docs entry.
 */
export type CoreMdxPayload = {
	id: string;
	name: string;
	docs: Record<string, CoreMdxDoc>;
};

/** Payload returned by the `core/story-docs` service for one component. */
export type CoreStoryDocsPayload = {
	id: string;
	name: string;
	path: string;
	import?: string;
	stories: Record<string, CoreStoryDoc>;
	error?: { name: string; message: string };
};

/**
 * Payload returned by the `core/docgen` service for one component. `argTypes` (a
 * UI-normalized view) is intentionally ignored by the adapter; prop types come
 * from `reactComponentMeta`/`react*` fields.
 */
export type CoreDocgenPayload = {
	id: string;
	name: string;
	path?: string;
	description?: string;
	summary?: string;
	jsDocTags?: Record<string, string[]>;
	import?: string;
	reactComponentMeta?: unknown;
	reactDocgen?: unknown;
	reactDocgenTypescript?: unknown;
	subcomponents?: Record<string, unknown>;
	error?: { name: string; message: string };
	[key: string]: unknown;
};

/**
 * A component assembled from the `core/docgen` payload plus the `core/story-docs`
 * stories and resolved attached MDX docs.
 */
export type CoreDocgenComponent = CoreDocgenPayload & {
	import?: string;
	/** Story snippets, either as a story-docs record or an already-resolved array. */
	stories?: Record<string, CoreStoryDoc> | Story[];
	/** Attached docs keyed by doc id (resolved MDX payloads). */
	docs?: Record<string, CoreMdxDoc>;
};

/**
 * Shared Valibot field for the storybookId input, used in multi-source mode.
 * Reused across tools that support source selection.
 */
export const StorybookIdField = {
	storybookId: v.pipe(
		v.string(),
		v.description(
			'The Storybook source ID (e.g., "local", "tetra"). Required when multiple Storybooks are composed. See list-all-documentation for available sources.',
		),
	),
};
