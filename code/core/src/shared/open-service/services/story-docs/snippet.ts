import { isEqual } from 'es-toolkit/predicate';

import { logger } from 'storybook/internal/client-logger';
import type { FillSnippetTemplate } from '../../../../docs-tools/snippetTemplate.ts';
import type { Args, Parameters } from 'storybook/internal/types';
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

/** The renderer's template filler, which it sets as `parameters.docs.source.fillTemplate`. */
export function getFillTemplate(
  parameters: Parameters | undefined
): FillSnippetTemplate | undefined {
  const fill = parameters?.docs?.source?.fillTemplate;
  return typeof fill === 'function' ? fill : undefined;
}

// Story ids whose filler failed; filling runs on every args change, so each warns once.
const storiesWarnedAbout = new Set<string>();

/**
 * Resolves the display snippet for one story with `args` filled into its `template`. Without args to
 * fill (the story still has the args it is written with), a template or a filler, or when filling
 * throws, it is the static snippet with the warning that belongs to it.
 */
export function selectLiveSnippetForStory(
  payload: StoryDocsPayload | undefined,
  storyId: string,
  args: Args | undefined,
  fill: FillSnippetTemplate | undefined
): { snippet?: string; warning?: string } {
  const staticSnippet = () => ({
    snippet: selectSnippetForStory(payload, storyId),
    warning: selectWarningForStory(payload, storyId),
  });
  const template = payload?.stories[storyId]?.template;
  if (args === undefined || template === undefined || fill === undefined) {
    return staticSnippet();
  }
  try {
    return { snippet: prependImportToSnippet(payload?.import, fill(template, args)) };
  } catch (error) {
    // An unprintable value is expected; anything else is a bug in the filler.
    const unprintable = error instanceof Error && error.name === 'UnprintableArgError';
    if (!unprintable && !storiesWarnedAbout.has(storyId)) {
      storiesWarnedAbout.add(storyId);
      logger.warn(`Could not fill the snippet of ${storyId} with its args: ${String(error)}`);
    }
    return staticSnippet();
  }
}

/**
 * The args to fill a story's template with: `undefined` while the story has the args it is written
 * with, so the snippet reads as written until the args change.
 */
export function argsToFill(story: {
  args: Args;
  unmappedArgs: Args;
  initialArgs: Args;
}): Args | undefined {
  return isEqual(story.unmappedArgs, story.initialArgs) ? undefined : story.args;
}

/** Resolves the incomplete-snippet warning for one story from a story-docs payload. */
export function selectWarningForStory(
  payload: StoryDocsPayload | undefined,
  storyId: string
): string | undefined {
  return payload?.stories[storyId]?.warning;
}
