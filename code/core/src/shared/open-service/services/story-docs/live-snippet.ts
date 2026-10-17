import { isEqual } from 'es-toolkit/predicate';

import { logger } from 'storybook/internal/client-logger';
import { type FillSnippetTemplate, asWrittenArgs } from '../../../../docs-tools/snippetTemplate.ts';
import type { Args, Parameters } from 'storybook/internal/types';

import { prependImportToSnippet, selectSnippetForStory, selectWarningForStory } from './snippet.ts';
import type { StoryDocsPayload } from './types.ts';

// The preview side of story snippets, which fills a story's template with its current args. Kept
// apart from `snippet.ts`, which the server imports too.

/** The renderer's template filler, which it sets as `parameters.docs.source.fillTemplate`. */
export function getFillTemplate(
  parameters: Parameters | undefined
): FillSnippetTemplate | undefined {
  const fill = parameters?.docs?.source?.fillTemplate;
  return typeof fill === 'function' ? fill : undefined;
}

// Story ids whose filler failed; filling runs on every args change, so each warns once.
const storiesWarnedAbout = new Set<string>();

/** The args a story renders with, before they are mapped, and those it is written with. */
export type StoryArgs = { args: Args; unmappedArgs: Args; initialArgs: Args };

/**
 * Resolves the display snippet for one story with its args filled into its `template`, with its
 * `templateWarning`. While the story still has the args it is written with, without a template or a
 * filler, or when filling throws, it is the static snippet with its `warning`.
 */
export function selectLiveSnippetForStory(
  payload: StoryDocsPayload | undefined,
  storyId: string,
  args: StoryArgs | undefined,
  fill: FillSnippetTemplate | undefined
): { snippet?: string; warning?: string } {
  const staticSnippet = () => ({
    snippet: selectSnippetForStory(payload, storyId),
    warning: selectWarningForStory(payload, storyId),
  });
  const story = payload?.stories[storyId];
  if (
    args === undefined ||
    isEqual(args.unmappedArgs, args.initialArgs) ||
    story?.template === undefined ||
    fill === undefined
  ) {
    return staticSnippet();
  }
  try {
    return {
      snippet: prependImportToSnippet(
        payload?.import,
        fill(story.template, asWrittenArgs(args, story.argCode))
      ),
      warning: story.templateWarning,
    };
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
