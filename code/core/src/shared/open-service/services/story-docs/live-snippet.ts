import { isEqual } from 'es-toolkit/predicate';

import { logger } from 'storybook/internal/client-logger';
import { type PrintHole, fillTemplate } from '../../../../docs-tools/snippetTemplate.ts';
import type { Args, Parameters } from 'storybook/internal/types';

import { prependImportToSnippet, selectSnippetForStory, selectWarningForStory } from './snippet.ts';
import type { StoryDocsPayload } from './types.ts';

// The preview side of story snippets, which fills a story's template with its current args. Kept
// apart from `snippet.ts`, which the server imports too.

/** The renderer's hole printer, which it sets as `parameters.docs.source.printHole`. */
export function getPrintHole(parameters: Parameters | undefined): PrintHole | undefined {
  const print = parameters?.docs?.source?.printHole;
  return typeof print === 'function' ? print : undefined;
}

// Story ids whose renderer failed; filling runs on every args change, so each warns once.
const storiesWarnedAbout = new Set<string>();

/**
 * The args a story renders with before they are mapped, as the static snippet reads them, and
 * those it is written with.
 */
export type StoryArgs = { unmappedArgs: Args; initialArgs: Args };

/**
 * Resolves the display snippet for one story with its args filled into its `template`. While the
 * story still has the args it is written with, or without a template or a hole printer, it is the
 * static snippet. Either comes with the story's `warning`; when the snippet cannot show a value, it
 * is the static snippet with a warning that names the arg.
 */
export function selectLiveSnippetForStory(
  payload: StoryDocsPayload | undefined,
  storyId: string,
  args: StoryArgs | undefined,
  printHole: PrintHole | undefined
): { snippet?: string; warning?: string } {
  const staticSnippet = (unprintable?: string) => ({
    snippet: selectSnippetForStory(payload, storyId),
    warning:
      [selectWarningForStory(payload, storyId), unprintable].filter(Boolean).join(' ') || undefined,
  });
  const story = payload?.stories[storyId];
  if (
    args === undefined ||
    isEqual(args.unmappedArgs, args.initialArgs) ||
    story?.template === undefined ||
    printHole === undefined
  ) {
    return staticSnippet();
  }
  try {
    return {
      snippet: prependImportToSnippet(
        payload?.import,
        fillTemplate(story.template, args, printHole)
      ),
      warning: story.warning,
    };
  } catch (error) {
    // By name: a renderer may bundle its own copy of the error class.
    if (error instanceof Error && error.name === 'UnprintableArgError') {
      return staticSnippet(error.message);
    }
    if (!storiesWarnedAbout.has(storyId)) {
      storiesWarnedAbout.add(storyId);
      logger.warn(`Could not fill the snippet of ${storyId} with its args: ${String(error)}`);
    }
    return staticSnippet();
  }
}
