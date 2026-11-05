import { isEqual } from 'es-toolkit/predicate';

import { logger } from 'storybook/internal/client-logger';
import { type PrintHole, fillTemplate } from '../../../../docs-tools/snippetTemplate.ts';
import type { Args, Parameters } from 'storybook/internal/types';

import { prependImportToSnippet, selectSnippetForStory, selectWarningForStory } from './snippet.ts';
import type { StoryDocsPayload } from './types.ts';

// The preview side of story snippets, which fills a story's template with its current args. Kept
// apart from `snippet.ts`, which the server imports too.

// The renderer's hole printer, which it sets as `parameters.docs.source.printHole`.
export function getPrintHole(parameters: Parameters | undefined): PrintHole | undefined {
  const print = parameters?.docs?.source?.printHole;
  return typeof print === 'function' ? print : undefined;
}

// Story ids whose renderer failed; filling runs on every args change, so each warns once.
const storiesWarnedAbout = new Set<string>();

// The args a story renders with before they are mapped, as the static snippet reads them, and
// those it is written with.
export type StoryArgs = { unmappedArgs: Args; initialArgs: Args };

/**
 * Whether a story renders with other args than those it is written with, so its template fills.
 * Never while `features.experimentalLiveServerSnippets` is off: the snippet then stays static, as before
 * live snippets.
 */
export const storyArgsChanged = ({ unmappedArgs, initialArgs }: StoryArgs) =>
  Boolean(globalThis.FEATURES?.experimentalLiveServerSnippets) &&
  !isEqual(definedArgs(unmappedArgs), definedArgs(initialArgs));

// An arg set to `undefined` is unset: the args store deletes it on every update, and the template
// fill reads it as absent too.
const definedArgs = (args: Args | undefined) =>
  Object.fromEntries(Object.entries(args ?? {}).filter(([, value]) => value !== undefined));

// Resolves the display snippet for one story with its args filled into its template. While the
// story still has the args it is written with, it is the static snippet. Either comes with the
// story's `warning`. Once the args changed, a snippet that cannot follow them is the static one with
// a warning that says so, naming the arg where it can.
export function selectLiveSnippetForStory(
  payload: StoryDocsPayload | undefined,
  storyId: string,
  args: StoryArgs,
  printHole: PrintHole | undefined
): { snippet?: string; warning?: string } {
  const staticSnippet = (reason?: string) => ({
    snippet: selectSnippetForStory(payload, storyId),
    warning:
      [selectWarningForStory(payload, storyId), reason].filter(Boolean).join(' ') || undefined,
  });
  if (!storyArgsChanged(args)) {
    return staticSnippet();
  }
  const story = payload?.stories[storyId];
  const stale = story?.snippet === undefined ? undefined : NOT_FOLLOWING;
  const template = story?.template;
  if (template === undefined || printHole === undefined) {
    return staticSnippet(stale);
  }
  try {
    return {
      snippet: prependImportToSnippet(payload?.import, fillTemplate(template, args, printHole)),
      warning: story?.warning,
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
    return staticSnippet(stale);
  }
}

const NOT_FOLLOWING = 'The snippet does not follow the changed args.';
