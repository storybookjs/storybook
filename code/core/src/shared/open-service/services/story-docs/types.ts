import type { SnippetTemplate } from '../../../../docs-tools/snippetTemplate.ts';
import type { Options } from '../../../../types/modules/core-common.ts';
import type { IndexEntry } from '../../../../types/modules/indexer.ts';

/**
 * Caller-facing input to a story-docs provider middleware.
 *
 * `entry` is a story-index entry of the CSF file to extract. A component whose stories are spread
 * over several files is extracted once per file, so a provider must not assume `entry` is the one
 * `selectComponentEntriesByComponentId` (in `storybook/internal/common`) selects for the component.
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
  /**
   * What a static pass could not resolve, in the source text it was written as. Next to a
   * `snippet` it marks the example as partial; on its own it says why no static snippet could be
   * produced at all. A filled template leaves out the same code, so it is shown with it too. An
   * `error` means the provider itself failed.
   */
  warning?: string;
  error?: StoryDocsError;
}

/** Story docs keyed by story id for O(1) lookup and fine-grained open-service subscriptions. */
export type StoryDocsById = Record<string, StoryDoc>;

/**
 * Story-docs payload returned by `core/story-docs`'s `storyDocs` query.
 *
 * Carries per-story snippets and descriptions. A provider either sets `import` or emits snippets
 * that already carry their own imports — see the story-docs service README for details.
 */
export interface StoryDocsPayload {
  id: string;
  name: string;
  /** CSF story file import path from the index entry. */
  path: string;
  /**
   * Import statement(s) prepended to every story snippet in docs.
   *
   * Left unset by providers whose snippets are self-contained, which is what new providers should
   * do; prepending to such a snippet would put an import block above source that already imports.
   */
  import?: string;
  stories: StoryDocsById;
  error?: StoryDocsError;
}

/**
 * A story's docs as a provider returns them: with the `template` the preview fills so its snippet
 * follows the controls. The service stores templates apart, under the `storyTemplates` query.
 */
export interface ProvidedStoryDoc extends StoryDoc {
  /**
   * The static `snippet` split into code and holes, each a place an arg prints with what the
   * snippet prints there; see `SnippetTemplate`. Joining its segments gives the snippet. Once the
   * args differ from the story's initial args, the preview fills it through the renderer's
   * `parameters.docs.source.printHole`, so the snippet follows the controls.
   */
  template?: SnippetTemplate;
}

/** A story-docs payload as a provider returns it, with each story's `template`. */
export interface ProvidedStoryDocsPayload extends Omit<StoryDocsPayload, 'stories'> {
  stories: Record<string, ProvidedStoryDoc>;
}

/**
 * The templates of a component's stories, returned by `core/story-docs`'s `storyTemplates` query.
 * They are kept apart from the {@link StoryDocsPayload}, which agents and the components manifest
 * read: only the preview fills them, and only once a story's args change.
 */
export interface StoryTemplatesPayload {
  /** Prepended to every template, as `StoryDocsPayload.import` is to every snippet. */
  import?: string;
  /** Each story's template by story id; a story without one cannot follow the controls. */
  stories: Record<string, SnippetTemplate>;
}

/**
 * Middleware-style provider function registered through the `experimental_storyDocsProvider` preset.
 */
export type StoryDocsProvider = (
  input: StoryDocsProviderInput
) => Promise<ProvidedStoryDocsPayload | undefined>;

/**
 * Preset signature for `experimental_storyDocsProvider`.
 */
export type StoryDocsProviderPreset = (
  nextStoryDocs: StoryDocsProvider,
  options: Options
) => StoryDocsProvider | Promise<StoryDocsProvider>;
