import { fillTemplate } from './fill-template-by-syntax.ts';
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

/**
 * Resolves the display snippet for one story with the given args filled in, falling back to the
 * static snippet when the provider gave no template.
 */
export function selectLiveSnippetForStory(
  payload: StoryDocsPayload | undefined,
  storyId: string,
  args: Record<string, unknown>
): string | undefined {
  const story = payload?.stories[storyId];
  if (story?.template === undefined) {
    return selectSnippetForStory(payload, storyId);
  }
  return prependImportToSnippet(
    payload?.import,
    fillTemplate(story.template, args, story.templateSyntax)
  );
}

/** Resolves the incomplete-snippet warning for one story from a story-docs payload. */
export function selectWarningForStory(
  payload: StoryDocsPayload | undefined,
  storyId: string
): string | undefined {
  return payload?.stories[storyId]?.warning;
}
