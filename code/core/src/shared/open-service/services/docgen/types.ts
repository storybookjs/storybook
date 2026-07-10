import type { StrictArgTypes } from '../../../../types/modules/csf.ts';
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

/** Free-form error attached to a payload or subcomponent. */
export interface DocgenError {
  name: string;
  message: string;
}

/** Compact JSDoc tag map: tag name → list of tag values (e.g. `@example a` → `{ example: ['a'] }`). */
export type DocgenJsDocTags = Record<string, string[]>;

/**
 * Docgen payload returned by `core/docgen`'s `docgen` query.
 *
 * Component-only fields (props, descriptions, subcomponents). Story snippets and file-level
 * imports live in `core/story-docs` when `experimentalDocgenServer` is enabled.
 */
export interface DocgenPayload {
  id: string;
  name: string;
  /** CSF story file import path from the index entry (same as component manifest `path`). */
  path: string;
  description?: string;
  summary?: string;
  jsDocTags: DocgenJsDocTags;
  /** Renderer-converted argTypes derived from integration-specific docgen data at write time. */
  argTypes?: StrictArgTypes;
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
  /** Renderer-converted argTypes derived from integration-specific docgen data at write time. */
  argTypes?: StrictArgTypes;
  error?: DocgenError;
  [key: string]: unknown;
}

/**
 * A docgen provider: given a component's index entry, returns a complete {@link DocgenPayload} or
 * `undefined` when no docgen is available for the file.
 *
 * Providers are composed middleware-style inside the docgen worker — each wraps the previous one in
 * the chain and may delegate to it to merge with downstream output.
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
 * Middleware that wraps the next provider in the docgen chain.
 *
 * The worker seeds the chain with an identity provider (returns `undefined`) and folds each
 * descriptor's middleware over it in registration order, so a later registrant wraps (and can
 * delegate to) the earlier ones.
 */
export type DocgenMiddleware = (nextDocgen: DocgenProvider) => DocgenProvider;

/**
 * Serializable descriptor a renderer or addon contributes via the `experimental_docgenProvider`
 * preset.
 *
 * Docgen extraction runs off the main thread in a long-lived worker owned by core. Because a
 * closure cannot cross a worker boundary, integrations describe their provider as data: a
 * `moduleSpecifier` pointing at a module that satisfies {@link DocgenWorkerModule}. Core collects
 * these descriptors (preserving preset order) and the worker imports and composes them.
 */
export interface DocgenProviderDescriptor {
  /** Absolute path to a module that exports {@link DocgenWorkerModule.createDocgenProvider}. */
  moduleSpecifier: string;
}

/**
 * Contract a worker-target docgen module must satisfy. The worker imports the descriptor's
 * `moduleSpecifier` and calls `createDocgenProvider()` once to build the middleware it folds into
 * the provider chain. Integrations implement only this factory — they never touch threading.
 */
export interface DocgenWorkerModule {
  createDocgenProvider: () => DocgenMiddleware | Promise<DocgenMiddleware>;
}
