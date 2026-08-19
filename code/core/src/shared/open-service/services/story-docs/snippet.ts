import { once } from '../../../../client-logger/index.ts';
import type { Args } from '../../../../types/modules/csf.ts';
import type { StoryDoc, StoryDocsPayload } from './types.ts';

/**
 * Rebuilds a story's snippet from its framework-owned template and the args a reader is looking at.
 *
 * Supplied by the framework through `docs.source.renderSnippetTemplate`, the same way
 * `docs.source.transform` is. Returning `undefined` means "this template is not mine to render" and
 * leaves the server's snippet in place; throwing means the same, and is caught.
 */
export type SnippetTemplateRenderer = (snippetTemplate: unknown, args: Args) => string | undefined;

/** Prepends a CSF file import block to a story snippet for display in docs and the Code panel. */
export function prependImportToSnippet(importBlock: string | undefined, snippet: string): string {
  const trimmedImport = importBlock?.trim();
  if (!trimmedImport) {
    return snippet;
  }
  return `${trimmedImport}\n\n${snippet}`;
}

/** Resolves the story-docs entry for one story from a story-docs payload. */
export function selectStoryDoc(
  payload: StoryDocsPayload | undefined,
  storyId: string
): StoryDoc | undefined {
  return payload?.stories[storyId];
}

/**
 * The story's snippet for the args in front of the reader.
 *
 * Falls back to the snippet the server rendered whenever anything is missing or goes wrong: no
 * template, no framework renderer, a value the framework cannot print. A snippet that lags the
 * Controls is merely stale; one rebuilt from a half-understood template would be wrong, and wrong
 * source is not copy-pasteable.
 */
export function renderStoryDocSnippet(
  story: StoryDoc,
  args: Args | undefined,
  render: SnippetTemplateRenderer | undefined
): string | undefined {
  if (story.snippet === undefined) {
    return undefined;
  }
  if (story.snippetTemplate === undefined || args === undefined || render === undefined) {
    return story.snippet;
  }
  try {
    return render(story.snippetTemplate, args) ?? story.snippet;
  } catch (error) {
    once.warn(
      `Could not rebuild the code snippet for "${story.id}" from the current args, so it shows the story's declared args instead. ${String(error)}`
    );
    return story.snippet;
  }
}

/**
 * Resolves the display snippet for one story from a story-docs payload.
 *
 * With `args` and the framework's renderer, a story that carries a snippet template is rebuilt for
 * those args, so the snippet shows what the reader is looking at rather than what the story
 * declared. Without them - or without a template - the server's snippet is used as-is.
 */
export function selectSnippetForStory(
  payload: StoryDocsPayload | undefined,
  storyId: string,
  args?: Args,
  render?: SnippetTemplateRenderer
): string | undefined {
  const story = payload?.stories[storyId];
  if (story === undefined) {
    return undefined;
  }
  const snippet = renderStoryDocSnippet(story, args, render);
  return snippet === undefined ? undefined : prependImportToSnippet(payload?.import, snippet);
}
