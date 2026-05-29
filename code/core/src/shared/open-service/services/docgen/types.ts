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
 * downstream providers, and either returns a complete {@link DocgenPayload} or `undefined` when
 * no docgen is available for the given file.
 */
export type DocgenProvider = (input: DocgenProviderInput) => Promise<DocgenPayload | undefined>;
