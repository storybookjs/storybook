import { isEqual, isPlainObject } from 'es-toolkit/predicate';

import { logger } from 'storybook/internal/client-logger';
import { type PrintHole, fillTemplate } from '../../../../docs-tools/snippetTemplate.ts';
import type { Args } from 'storybook/internal/types';

import { prependImportToSnippet, selectSnippetForStory, selectWarningForStory } from './snippet.ts';
import type { StoryDocsPayload } from './types.ts';

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

// Whether the manager reads the args the preview renders with. The channel drops a function, also
// inside an object or array, so the manager cannot see one the preview sets in place of the
// story's own.
export function argsReachManager({ unmappedArgs, initialArgs }: StoryArgs): boolean {
  return Object.keys({ ...initialArgs, ...unmappedArgs }).every(
    (key) =>
      unmappedArgs[key] === initialArgs[key] ||
      !(holdsFunction(unmappedArgs[key]) || holdsFunction(initialArgs[key]))
  );
}

function holdsFunction(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof value === 'function') {
    return true;
  }
  if (typeof value !== 'object' || value === null || seen.has(value)) {
    return false;
  }
  seen.add(value);
  return Object.values(value).some((item) => holdsFunction(item, seen));
}

// The channel sends a class instance, a Map or a Set as a plain object marked
// `__isClassInstance__`. As an instance of this class instead, it prints as the preview prints the
// original: a printer that prints no class instance fails, and `JSON.stringify` writes its fields.
class SentInstance {}

// Returns `value` itself unless it holds a marked object.
function restoreSentInstances(value: unknown, seen = new Set<object>()): unknown {
  if (
    typeof value !== 'object' ||
    value === null ||
    seen.has(value) ||
    !(Array.isArray(value) || isPlainObject(value))
  ) {
    return value;
  }
  seen.add(value);
  const marked = !Array.isArray(value) && value.__isClassInstance__ === true;
  const entries = Object.entries(value)
    .filter(([key]) => !marked || (key !== '__isClassInstance__' && key !== '__className__'))
    .map(([key, item]) => [key, restoreSentInstances(item, seen)] as const);
  if (!marked && entries.every(([key, item]) => item === (value as Args)[key])) {
    return value;
  }
  return Object.assign(
    Array.isArray(value) ? new Array(value.length) : marked ? new SentInstance() : {},
    Object.fromEntries(entries)
  );
}

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
  const restoredArgs = {
    unmappedArgs: restoreSentInstances(args.unmappedArgs) as Args,
    initialArgs: restoreSentInstances(args.initialArgs) as Args,
  };
  try {
    return {
      snippet: prependImportToSnippet(
        payload?.import,
        fillTemplate(template, restoredArgs, printHole)
      ),
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
