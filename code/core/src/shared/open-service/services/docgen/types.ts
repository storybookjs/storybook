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

/**
 * Phase-1 docgen payload returned by `core/docgen`'s `getDocgen` query.
 *
 * The schema is intentionally minimal so the first slice ships without committing to a final
 * props/subcomponent shape. Phase 3 will extend this with real `props`, `subcomponents`, and
 * `stories[]` fields backed by RCM output.
 */
export interface DocgenPayload {
  componentId: string;
  name: string;
  description: string;
  props: unknown[];
}

/**
 * Middleware-style provider function registered through the `experimental_docgenProvider` preset.
 *
 * Each registrant returns a wrapper around the previous accumulated provider (received as the
 * preset's `config` argument). The wrapper may call its inner `nextDocgen` to merge with
 * downstream providers, and must produce a complete {@link DocgenPayload}.
 */
export type DocgenProvider = (input: DocgenProviderInput) => Promise<DocgenPayload>;
