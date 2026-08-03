/**
 * Structural port of the manifest types consumed by the `@storybook/mcp` manifest formatter
 * (`packages/mcp/src/types.ts`). The source defines these as valibot schemas because it validates
 * fetched manifests; here they type in-process data only, so the inferred shapes are ported as
 * plain types. Both copies must not drift until Milestone 4 deletes the original.
 */

export type ManifestError = {
  name: string;
  message: string;
};

export type Story = {
  name: string;
  description?: string;
  jsDocTags?: Record<string, string[]>;
  error?: ManifestError;
  id?: string;
  snippet?: string;
  summary?: string;
};

/** Inline (v0) docs entry: the full MDX `content` is embedded. */
export type DocV0 = {
  id: string;
  name: string;
  title?: string;
  path?: string;
  content?: string;
  summary?: string;
  error?: ManifestError;
};

/**
 * Shallow (v1) docs entry. Storybook's in-process dev index carries just identity and summary;
 * the full MDX payload is resolved separately.
 */
export type DocV1 = {
  id: string;
  name: string;
  summary?: string;
  error?: ManifestError;
};

/* eslint-disable @typescript-eslint/no-explicit-any -- mirrors the source schema's `v.any()`
   docgen-engine fields, which the parsers narrow structurally at runtime. */
type BaseInlineComponentProperties = {
  name: string;
  description?: string;
  jsDocTags?: Record<string, string[]>;
  error?: ManifestError;
  path?: string;
  summary?: string;
  import?: string;
  reactDocgen?: any;
  reactDocgenTypescript?: any;
  reactComponentMeta?: any;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

export type SubcomponentManifest = BaseInlineComponentProperties;

/** Inline (v0) component: docgen, stories and attached docs are all embedded. */
export type ComponentManifestV0 = BaseInlineComponentProperties & {
  id: string;
  stories?: Story[];
  subcomponents?: Record<string, SubcomponentManifest>;
  docs?: Record<string, DocV0>;
};

/** Shallow (v1) component index row: identity + summary inlined for cheap listing. */
export type ComponentManifestV1 = {
  id: string;
  name: string;
  description?: string;
  summary?: string;
  error?: ManifestError;
  /** Inline stories, present when the list is built with story ids resolved. */
  stories?: Story[];
};

export type ComponentManifestMap =
  | { v: 0; components: Record<string, ComponentManifestV0> }
  | { v: 1; components: Record<string, ComponentManifestV1> };

export type DocsManifestMap =
  | { v: 0; docs: Record<string, DocV0> }
  | { v: 1; docs: Record<string, DocV1> };

/** A component index row as it appears in either format. */
export type ComponentManifestEntry = ComponentManifestV0 | ComponentManifestV1;

/** A docs index row as it appears in either format. */
export type DocEntry = DocV0 | DocV1;

/**
 * A fully-resolved component, as consumed by the formatters: inline shape (stories as an array,
 * attached docs with `content`, docgen inlined). Identical to the v0 shape.
 */
export type ComponentManifest = ComponentManifestV0;

/** A fully-resolved docs entry (inline `content`), as consumed by the formatters. */
export type Doc = DocV0;

export type AllManifests = {
  componentManifest: ComponentManifestMap;
  docsManifest?: DocsManifestMap;
};
