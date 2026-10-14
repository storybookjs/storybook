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
  /**
   * The story's code with a hole, `⟦kind word…⟧`, wherever it reads an arg, such as
   * `<Button⟦props⟧ />`; see `FillSnippetTemplate`. Once the args differ from the story's initial
   * args, the preview fills it through the renderer's `parameters.docs.source.fillTemplate`, so the
   * snippet follows the controls. Set only when every arg read is a hole.
   */
  template?: string;
  /**
   * The code the static snippet prints for each arg it writes as code, such as `shout`,
   * `fn((o) => o.name)` or `new Date('2024-01-01')`. The preview fills an arg that still holds the
   * value the story is written with as this code, so the filled snippet keeps it as written; an arg
   * a control changed prints its value. An arg written as a literal its value prints as, such as
   * `'Go'`, may be left out.
   */
  argCode?: Record<string, string>;
  /**
   * What the filled `template` still leaves out, such as an `NgModule` the component needs, shown
   * with it in place of `warning`. The provider chooses it, as it knows which parts of `warning`
   * are about arg values, which the filled snippet has.
   */
  templateWarning?: string;
  description?: string;
  summary?: string;
  /**
   * What a static pass could not resolve, in the source text it was written as. Next to a
   * `snippet` it marks the example as partial; on its own it says why no static snippet could be
   * produced at all. It belongs to the static snippet, which reads arg values from the source: a
   * filled `template` has the runtime values instead, and `templateWarning` says what it leaves
   * out. An `error` means the provider itself failed.
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
