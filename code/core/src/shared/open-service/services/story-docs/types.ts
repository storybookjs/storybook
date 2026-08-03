import type { Options } from '../../../../types/modules/core-common.ts';
import type { IndexEntry } from '../../../../types/modules/indexer.ts';

/**
 * Caller-facing input to a story-docs provider middleware.
 *
 * `entry` is the authoritative story-index entry for the requested component, selected with the
 * same rules as the React component manifest generator (`selectComponentEntriesByComponentId` in
 * `storybook/internal/common`).
 */
export interface StoryDocsProviderInput {
  entry: IndexEntry;
}

/** Free-form error attached to a story snippet entry. */
export interface StoryDocsError {
  name: string;
  message: string;
}

/** Snippet + metadata for one story under a component. */
export interface StoryDoc {
  id: string;
  name: string;
  snippet?: string;
  description?: string;
  summary?: string;
  error?: StoryDocsError;
}

/** Story docs keyed by story id for O(1) lookup and fine-grained open-service subscriptions. */
export type StoryDocsById = Record<string, StoryDoc>;

/**
 * Story-docs payload returned by `core/story-docs`'s `storyDocs` query.
 *
 * Carries per-story snippets and descriptions plus file-level import statements. Import snippets
 * do not currently honor the component `@import` JSDoc override tag — see the story-docs service
 * README for details.
 */
export interface StoryDocsPayload {
  id: string;
  name: string;
  /** CSF story file import path from the index entry. */
  path: string;
  /** Suggested import statement(s) prepended to story snippets in docs. */
  import?: string;
  stories: StoryDocsById;
  error?: StoryDocsError;
}

/**
 * Middleware-style provider function registered through the `experimental_storyDocsProvider` preset.
 */
export type StoryDocsProvider = (
  input: StoryDocsProviderInput
) => Promise<StoryDocsPayload | undefined>;

/**
 * Preset signature for `experimental_storyDocsProvider`.
 */
export type StoryDocsProviderPreset = (
  nextStoryDocs: StoryDocsProvider,
  options: Options
) => StoryDocsProvider | Promise<StoryDocsProvider>;
