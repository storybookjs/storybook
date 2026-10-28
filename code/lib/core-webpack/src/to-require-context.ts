import { globToRegexp } from 'storybook/internal/common';
import type { NormalizedStoriesSpecifier } from 'storybook/internal/types';

/** @deprecated Unused by Storybook's builders; use `toImportFn`. */
export const toRequireContext = (specifier: NormalizedStoriesSpecifier) => {
  const { directory, files } = specifier;

  // The importPathMatcher is a `./`-prefixed matcher that includes the directory
  // For `require.context()` we want the same thing, relative to directory
  const match = globToRegexp(`./${files}`);

  return {
    path: directory,
    recursive: files.includes('**') || files.split('/').length > 1,
    match,
  };
};

/** @deprecated Unused by Storybook's builders; use `toImportFn`. */
export const toRequireContextString = (specifier: NormalizedStoriesSpecifier) => {
  const { path: p, recursive: r, match: m } = toRequireContext(specifier);

  const result = `require.context('${p}', ${r}, ${m})`;
  return result;
};
