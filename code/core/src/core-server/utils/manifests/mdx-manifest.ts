/**
 * Canonical contract for the MDX docs open service.
 *
 * The service implementation lives in `@storybook/addon-docs`, but the data contract (service id,
 * on-disk/`$ref` layout, payload shapes, and the consumer query handle) lives here in core so the
 * addon that produces it and the core manifest writer that consumes it share one source of truth.
 * Mirrors the docgen service contract under `shared/open-service/services/docgen/`.
 */

/** A JSON Reference (`{ $ref }`) pointing at a value in another manifest document. */
export type JsonRef = { $ref: string };

/** Open-service id for the MDX docs service (also the on-disk directory under `services/`). */
export const MDX_SERVICE_ID = 'addon-docs/mdx';

/** Free-form error captured while reading or analyzing an MDX doc. */
export interface MdxError {
  name: string;
  message: string;
}

/**
 * One MDX doc, both as stored in the service and as resolved from a manifest `$ref`.
 *
 * `summary` shares `content`'s optionality: it is derived from the doc when available (an explicit
 * `Meta` summary, falling back to text extracted from the content) and omitted otherwise.
 */
export interface MdxDocPayload {
  id: string;
  name: string;
  path: string;
  title: string;
  content?: string;
  summary?: string;
  error?: MdxError;
  mdx?: never;
}

/** Per-component MDX payload: every doc grouped under a single component (or standalone) id. */
export interface MdxPayload {
  id: string;
  name: string;
  docs: Record<string, MdxDocPayload>;
}

/**
 * Shape of one MDX service snapshot document, and of the live `getMdxForAllComponents` output once
 * wrapped under `components`. Both resolve the same `$ref` JSON pointers.
 */
export interface MdxRefDocument {
  components: Record<string, MdxPayload>;
}

/** Shallow docs index row: id, name, optional summary, and a `$ref` to the full MDX payload. */
export interface DocsManifestRefEntry {
  id: string;
  name: string;
  summary?: string;
  mdx: JsonRef;
  path?: never;
  title?: never;
  content?: never;
  error?: never;
}

/** A docs manifest entry is either an inline payload or a shallow `$ref` row. */
export type DocsManifestEntry = MdxDocPayload | DocsManifestRefEntry;

/** Minimal consumer handle for reading every MDX payload from the live service (dev). */
export interface MdxServiceContract {
  queries: {
    getMdxForAllComponents: {
      loaded: () => Promise<Record<string, MdxPayload>>;
    };
  };
}

/** Relative path segment for one component's static snapshot file (`<id>.json`). */
export function mdxQueryStaticPath(id: string): string {
  return `${id}.json`;
}

/** Logical static-store key: `addon-docs/mdx/<id>.json`. */
export function mdxStaticStorePath(id: string): string {
  return `${MDX_SERVICE_ID}/${mdxQueryStaticPath(id)}`;
}

/** JSON Pointer from a snapshot root to one component payload. */
export function mdxPayloadJsonPointer(id: string): string {
  return `/components/${id}`;
}

/** JSON Pointer from a snapshot root to one doc within a component payload. */
export function mdxDocJsonPointer(componentId: string, docId: string): string {
  return `${mdxPayloadJsonPointer(componentId)}/docs/${docId}`;
}

/** `$ref` target for one doc, relative to the `manifests/` directory. */
export function mdxManifestRef(componentId: string, docId: string): string {
  return `../services/${mdxStaticStorePath(componentId)}#${mdxDocJsonPointer(componentId, docId)}`;
}
