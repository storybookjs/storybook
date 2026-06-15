import type { StoryDocsPayload } from './types.ts';

/** Prepends a CSF file import block to a story snippet for display in docs and the Code panel. */
export function prependImportToSnippet(importBlock: string | undefined, snippet: string): string {
  const trimmedImport = importBlock?.trim();
  if (!trimmedImport) {
    return snippet;
  }
  return `${trimmedImport}\n\n${snippet}`;
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
