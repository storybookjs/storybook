import type { Options } from '../../../../types/modules/core-common.ts';
import type { IndexEntry } from '../../../../types/modules/indexer.ts';

/**
 * Caller-facing input to a docgen provider middleware.
 *
 * `entry` is the authoritative story-index entry for the requested component, selected with the
 * same rules as the React component manifest generator (`selectComponentEntriesByComponentId` in
 * `storybook/internal/common`): eligible story entries and attached docs, with story entries
 * preferred over attached docs for the same component id.
 */
export interface DocgenProviderInput {
  entry: IndexEntry;
}

/** Free-form error attached to a payload, subcomponent, or story snippet. */
export interface DocgenError {
  name: string;
  message: string;
}

/** Compact JSDoc tag map: tag name → list of tag values (e.g. `@example a` → `{ example: ['a'] }`). */
export type DocgenJsDocTags = Record<string, string[]>;

/** Snippet + metadata for one story under a component. */
export interface DocgenStory {
  id: string;
  name: string;
  snippet?: string;
  description?: string;
  summary?: string;
  error?: DocgenError;
}

/**
 * Docgen payload returned by `core/docgen`'s `getDocgen` query.
 *
 * Aligns with {@link ComponentManifest} plus integration-specific keys (for example
 * `reactComponentMeta`, `reactDocgen`, `reactDocgenTypescript`) via the index signature.
 */
export interface DocgenPayload {
  id: string;
  name: string;
  /** CSF story file import path from the index entry (same as component manifest `path`). */
  path: string;
  description?: string;
  /** Suggested import statement(s) for the component (same as component manifest `import`). */
  import?: string;
  summary?: string;
  jsDocTags: DocgenJsDocTags;
  stories: DocgenStory[];
  subcomponents?: Record<string, DocgenSubcomponent>;
  error?: DocgenError;
  [key: string]: unknown;
}

/** Component-level summary + docgen for one subcomponent. */
export interface DocgenSubcomponent {
  name: string;
  path: string;
  description?: string;
  summary?: string;
  import?: string;
  jsDocTags: DocgenJsDocTags;
  error?: DocgenError;
  [key: string]: unknown;
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
