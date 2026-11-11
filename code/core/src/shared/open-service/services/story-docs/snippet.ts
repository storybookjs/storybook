import type { StoryDoc, StoryDocsPayload } from './types.ts';

/** The code a CSF file import block puts before a story snippet: the block and a blank line. */
export function importPrefix(importBlock: string | undefined): string {
  const trimmedImport = importBlock?.trim();
  return trimmedImport ? `${trimmedImport}\n\n` : '';
}

/** Prepends a CSF file import block to a story snippet for display in docs and the Code panel. */
export function prependImportToSnippet(importBlock: string | undefined, snippet: string): string {
  return importPrefix(importBlock) + snippet;
}

/** Resolves the story-docs entry for one story from a story-docs payload. */
export function selectStoryDoc(
  payload: StoryDocsPayload | undefined,
  storyId: string
): StoryDoc | undefined {
  return payload?.stories[storyId];
}

/** Resolves the display snippet for one story from a story-docs payload. */
export function selectSnippetForStory(
  payload: StoryDocsPayload | undefined,
  storyId: string
): string | undefined {
  const story = payload?.stories[storyId];
  if (story?.snippet === undefined) {
    return undefined;
  }
  return prependImportToSnippet(payload?.import, story.snippet);
}

/** Resolves the incomplete-snippet warning for one story from a story-docs payload. */
export function selectWarningForStory(
  payload: StoryDocsPayload | undefined,
  storyId: string
): string | undefined {
  return payload?.stories[storyId]?.warning;
}
