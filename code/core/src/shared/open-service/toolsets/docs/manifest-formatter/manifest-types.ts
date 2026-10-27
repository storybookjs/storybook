/**
 * The component/docs manifest format, as schemas.
 *
 * Storybook writes one of two formats, distinguished by the top-level `v` field on
 * `components.json` / `docs.json`:
 *
 * - v0 — inline/legacy: every component carries its docgen, stories array and attached docs (with
 *   MDX `content`) inline.
 * - v1 — split/ref: the manifests are shallow indexes; the heavy docgen, story-docs and MDX
 *   payloads live in sibling `services/*.json` files and are referenced via `$ref`. The in-process
 *   dev index emits an even shallower v1 (no `docgen`/`mdx` refs), because those entries are
 *   resolved from the open services instead.
 *
 * These are valibot schemas rather than plain types because manifests fetched from a hosted
 * Storybook are untrusted input and are validated on arrival. In-process callers build the same
 * shapes directly and skip validation; the `$ref` fields are optional, so an in-process row is a
 * valid instance of the same type.
 */

import * as v from 'valibot';

const JSDocTag = v.record(v.string(), v.array(v.string()));

const ManifestErrorSchema = v.object({
  name: v.string(),
  message: v.string(),
});
export type ManifestError = v.InferOutput<typeof ManifestErrorSchema>;

const BaseManifest = v.object({
  name: v.string(),
  description: v.optional(v.string()),
  jsDocTags: v.optional(JSDocTag),
  error: v.optional(ManifestErrorSchema),
});

const StorySchema = v.object({
  ...BaseManifest.entries,
  id: v.optional(v.string()),
  snippet: v.optional(v.string()),
  summary: v.optional(v.string()),
});
export type Story = v.InferOutput<typeof StorySchema>;

/**
 * A JSON Reference (`{ $ref }`) pointing at a value in another manifest document. Used by the v1
 * (split/ref) format for docgen, story-docs and MDX payloads.
 */
export const JsonRef = v.object({
  $ref: v.string(),
});
export type JsonRef = v.InferOutput<typeof JsonRef>;

// ---- v0: inline / legacy ----

/** Inline (v0) docs entry: the full MDX `content` is embedded. */
export const DocV0 = v.object({
  id: v.string(),
  name: v.string(),
  title: v.optional(v.string()),
  path: v.optional(v.string()),
  content: v.optional(v.string()),
  summary: v.optional(v.string()),
  error: v.optional(ManifestErrorSchema),
});
export type DocV0 = v.InferOutput<typeof DocV0>;

const BaseInlineComponentProperties = v.object({
  ...BaseManifest.entries,
  path: v.optional(v.string()),
  summary: v.optional(v.string()),
  import: v.optional(v.string()),
  // Framework-authored Markdown, rendered in place of the props section derived from `react*`.
  apiDescription: v.optional(v.string()),
  renderer: v.optional(v.string()),
  // Mirrors the docgen-engine payloads, which the parsers narrow structurally at runtime.
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
  stories: v.optional(v.array(StorySchema)),
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
 * Shallow (v1) docs entry. The full MDX payload lives behind `mdx.$ref`; `mdx` is optional because
 * the in-process dev index omits it.
 */
export const DocV1 = v.object({
  id: v.string(),
  name: v.string(),
  summary: v.optional(v.string()),
  mdx: v.optional(JsonRef),
  error: v.optional(ManifestErrorSchema),
});
export type DocV1 = v.InferOutput<typeof DocV1>;

/**
 * Shallow (v1) component index row. Identity and summary are inlined for cheap listing; docgen and
 * story-docs live behind `$ref`s, attached docs behind nested `mdx.$ref`s. `stories` may also be an
 * inline array, which is how a listing built with story ids resolved carries them.
 */
export const ComponentManifestV1 = v.object({
  id: v.string(),
  name: v.string(),
  description: v.optional(v.string()),
  summary: v.optional(v.string()),
  error: v.optional(ManifestErrorSchema),
  docgen: v.optional(JsonRef),
  stories: v.optional(v.union([JsonRef, v.array(StorySchema)])),
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

/** `docs.json` for standalone documentation entries, discriminated on `v`. */
export const DocsManifestMap = v.variant('v', [DocsManifestMapV0, DocsManifestMapV1]);
export type DocsManifestMap = v.InferOutput<typeof DocsManifestMap>;

// ---- working / resolved types ----

/** A component index row as it appears in either format. */
export type ComponentManifestEntry = ComponentManifestV0 | ComponentManifestV1;

/** A docs index row as it appears in either format. */
export type DocEntry = DocV0 | DocV1;

/**
 * A fully-resolved component, as consumed by the formatters: inline shape (stories as an array,
 * attached docs with `content`, docgen inlined). Identical to the v0 shape — v1 rows reach it by
 * following their `$ref`s, or by being built in-process from the open services.
 */
export type ComponentManifest = ComponentManifestV0;

/** A fully-resolved docs entry (inline `content`), as consumed by the formatters. */
export type Doc = DocV0;

export type AllManifests = {
  componentManifest: ComponentManifestMap;
  docsManifest?: DocsManifestMap;
};
