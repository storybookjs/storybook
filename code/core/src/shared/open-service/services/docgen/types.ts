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
