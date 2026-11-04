import { isEqual } from 'es-toolkit/predicate';

import { logger } from 'storybook/internal/client-logger';
import {
  type PrintHole,
  fillTemplate,
  stripHoles,
} from '../../../../docs-tools/snippetTemplate.ts';
import type { Args, Parameters } from 'storybook/internal/types';

import type { StoryDocsService } from './definition.ts';
import { prependImportToSnippet, selectSnippetForStory, selectWarningForStory } from './snippet.ts';
import type { StoryDocsPayload, StoryTemplatesPayload } from './types.ts';

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

/** Whether a story renders with other args than those it is written with, so its template fills. */
export const storyArgsChanged = (args: StoryArgs | undefined) =>
  args !== undefined && !isEqual(args.unmappedArgs, args.initialArgs);

// Each component's templates load once a story of it first renders with changed args. A static
// build serves them as a file of their own, which does not change, and a dev server keeps them
// current with its story docs, so a component never loads them twice. By query, so each service
// runtime loads its own.
const templateLoads = new WeakMap<object, Map<string, Promise<void>>>();

/**
 * Loads the templates of a component's stories, which its story docs leave out, once per
 * component. A failed load settles without them, so its snippets show the static snippet with a
 * warning, and is tried again on the next call.
 */
export function loadStoryTemplates(service: StoryDocsService, componentId: string): Promise<void> {
  const query = service.queries.storyTemplates;
  if (query.get({ id: componentId }) !== undefined) {
    return Promise.resolve();
  }
  let loads = templateLoads.get(query);
  if (!loads) {
    loads = new Map();
    templateLoads.set(query, loads);
  }
  let load = loads.get(componentId);
  if (!load) {
    load = query.loaded({ id: componentId }).then(
      () => undefined,
      (error: unknown) => {
        loads.delete(componentId);
        logger.debug(`Story templates of ${componentId} unavailable: ${String(error)}`);
      }
    );
    loads.set(componentId, load);
  }
  return load;
}

// Resolves the display snippet for one story with its args filled into its template. While the
// story still has the args it is written with, it is the static snippet. Either comes with the
// story's `warning`. Once the args changed, a snippet that cannot follow them is the static one with
// a warning that says so, naming the arg where it can.
//
// `templates` is the component's templates, `'loading'` while they load, which shows the static
// snippet for that moment, or `undefined` when they could not load.
export function selectLiveSnippetForStory(
  payload: StoryDocsPayload | undefined,
  templates: StoryTemplatesPayload | 'loading' | undefined,
  storyId: string,
  args: StoryArgs | undefined,
  printHole: PrintHole | undefined
): { snippet?: string; warning?: string } {
  const staticSnippet = (unprintable?: string) => ({
    snippet: selectSnippetForStory(payload, storyId),
    warning:
      [selectWarningForStory(payload, storyId), unprintable].filter(Boolean).join(' ') || undefined,
  });
  if (!storyArgsChanged(args) || templates === 'loading') {
    return staticSnippet();
  }
  const story = payload?.stories[storyId];
  const stale = story?.snippet === undefined ? undefined : NOT_FOLLOWING;
  const template = templates?.stories[storyId];
  // The templates load apart from the story docs, so a template from another revision of the
  // story file than its snippet does not follow it.
  if (
    template === undefined ||
    printHole === undefined ||
    stripHoles(template) !== story?.snippet
  ) {
    return staticSnippet(stale);
  }
  try {
    return {
      snippet: prependImportToSnippet(payload?.import, fillTemplate(template, args!, printHole)),
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
