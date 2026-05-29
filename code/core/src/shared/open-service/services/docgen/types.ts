/**
 * Caller-facing input to a docgen provider middleware.
 *
 * `importPath` is the value taken directly from the matching {@link IndexEntry.importPath} — a
 * relative path to a CSF story file (or an .mdx file for attached-docs entries). Providers that
 * only know how to read CSF should bail (return `undefined` or forward to `nextDocgen`) when the
 * path does not point at a story file they understand.
 */
export interface DocgenProviderInput {
  importPath: string;
}

/** Free-form error attached to a payload, subcomponent, or story snippet. */
export interface DocgenError {
  name: string;
  message: string;
}

/** Compact JSDoc tag map: tag name → list of tag values (e.g. `@example a` → `{ example: ['a'] }`). */
export type DocgenJsDocTags = Record<string, string[]>;

/** One prop on a component (and any subcomponent). Mirrors RCM's `PropItem` shape. */
export interface DocgenProp {
  name: string;
  required: boolean;
  type: { name: string; raw?: string; value?: { value: string }[] };
  description: string;
  defaultValue: { value: string } | null;
  jsDocTags?: DocgenJsDocTags;
}

/** Snippet + metadata for one story under a component. */
export interface DocgenStory {
  id: string;
  name: string;
  snippet?: string;
  description?: string;
  summary?: string;
  error?: DocgenError;
}

/** Component-level summary + props + JSDoc for one subcomponent. */
export interface DocgenSubcomponent {
  name: string;
  description?: string;
  summary?: string;
  jsDocTags?: DocgenJsDocTags;
  props: DocgenProp[];
  error?: DocgenError;
}

/**
 * Docgen payload returned by `core/docgen`'s `getDocgen` query.
 *
 * Producers (renderer + addon providers) populate the fields they have data for; the others stay
 * empty/undefined. Consumers should treat every field as optionally present in a real-world
 * payload, even if the schema requires it (validation pads missing fields where possible).
 */
export interface DocgenPayload {
  componentId: string;
  name: string;
  description: string;
  summary?: string;
  jsDocTags?: DocgenJsDocTags;
  props: DocgenProp[];
  subcomponents?: Record<string, DocgenSubcomponent>;
  stories?: DocgenStory[];
  error?: DocgenError;
}

/**
 * Middleware-style provider function registered through the `experimental_docgenProvider` preset.
 *
 * Each registrant returns a wrapper around the previous accumulated provider (received as the
 * preset's `config` argument). The wrapper may call its inner `nextDocgen` to merge with
 * downstream providers, and either returns a complete {@link DocgenPayload} or `undefined` when
 * no docgen is available for the given file.
 */
export type DocgenProvider = (input: DocgenProviderInput) => Promise<DocgenPayload | undefined>;
