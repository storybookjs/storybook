import type { Options } from '../../../../types/modules/core-common.ts';

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
 * Each registrant returns a wrapper around the previous accumulated provider; it may call that
 * inner provider to merge with downstream output, and either returns a complete
 * {@link DocgenPayload} or `undefined` when no docgen is available for the given file.
 *
 * **Merge convention.** When combining your output with downstream's, use spread
 * (`{ ...downstream, ...yourOverrides }`) and `downstream?.field ?? yours` rather than rebuilding
 * the payload field-by-field. Manual reconstruction silently drops any fields a future provider
 * (or future schema change) adds and your provider doesn't know about. `??` preserves explicit
 * values from downstream — including empty strings — so providers that intentionally set a field
 * are not overridden by a later provider's defaults.
 */
export type DocgenProvider = (input: DocgenProviderInput) => Promise<DocgenPayload | undefined>;

/**
 * Preset signature for `experimental_docgenProvider`.
 *
 * Like `PresetPropertyFn<'experimental_docgenProvider'>` but with `nextDocgen` typed as
 * non-nullable. Core's `services` preset always seeds the middleware chain with an identity
 * provider, so the optional typing inherited from `StorybookConfigRaw` is impossible-state
 * defense at the provider-author level — use this type to drop the `?.` noise. If the seed is
 * ever missing at runtime, that's a preset-wiring bug and the provider will throw on the first
 * `nextDocgen(...)` call rather than silently degrading.
 */
export type DocgenProviderPreset = (
  nextDocgen: DocgenProvider,
  options: Options
) => DocgenProvider | Promise<DocgenProvider>;
