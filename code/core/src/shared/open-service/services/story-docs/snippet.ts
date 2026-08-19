import type { Args } from '../../../../types/modules/csf.ts';
import { renderStoryDocSnippet } from './recipe-renderer.ts';
import type { StoryDoc, StoryDocsPayload } from './types.ts';

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
 * Resolves the display snippet for one story from a story-docs payload.
 *
 * With `args`, a story that carries a recipe is rebuilt for those args, so the snippet shows what
 * the reader is looking at rather than what the story declared. Without them - or without a recipe -
 * the server's snippet is used as-is.
 */
export function selectSnippetForStory(
  payload: StoryDocsPayload | undefined,
  storyId: string,
  args?: Args
): string | undefined {
  const story = payload?.stories[storyId];
  if (story === undefined) {
    return undefined;
  }
  const snippet = renderStoryDocSnippet(story, args);
  return snippet === undefined ? undefined : prependImportToSnippet(payload?.import, snippet);
}
