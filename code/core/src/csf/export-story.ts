import { toStartCaseStr } from './toStartCaseStr.ts';

type StoryDescriptor = string[] | RegExp;

export interface IncludeExcludeOptions {
  includeStories?: StoryDescriptor;
  excludeStories?: StoryDescriptor;
}

function matches(storyKey: string, arrayOrRegex: StoryDescriptor) {
  if (Array.isArray(arrayOrRegex)) {
    return arrayOrRegex.includes(storyKey);
  }
  return storyKey.match(arrayOrRegex);
}

/** Transform a CSF named export into a readable story name */
export const storyNameFromExport = (key: string) => toStartCaseStr(key);

/** Does a named export match CSF inclusion/exclusion options? */
export function isExportStory(
  key: string,
  { includeStories, excludeStories }: IncludeExcludeOptions
) {
  return (
    // Babel's CommonJS interop adds __esModule; it is not a CSF story export.
    key !== '__esModule' &&
    (!includeStories || matches(key, includeStories)) &&
    (!excludeStories || !matches(key, excludeStories))
  );
}
