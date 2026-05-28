import type { IndexEntry } from '../../../../types/modules/indexer.ts';

/**
 * Caller-facing input to a docgen provider middleware.
 *
 * `componentId` is the story-index componentId (the prefix before the first `--` in a story id).
 * `entries` is the set of story / attached-docs entries that resolve to that componentId — the
 * docgen service pre-resolves them from the story index so each provider can act without
 * re-reading the index.
 */
export interface DocgenProviderInput {
  componentId: string;
  entries: IndexEntry[];
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
 * downstream providers, and must produce a complete {@link DocgenPayload}.
 */
export type DocgenProvider = (input: DocgenProviderInput) => Promise<DocgenPayload>;
