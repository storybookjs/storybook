import { lstatSync } from 'node:fs';
import { basename, dirname, relative, resolve } from 'node:path';

import { InvalidStoriesEntryError } from 'storybook/internal/server-errors';
import type { NormalizedStoriesSpecifier, StoriesEntry } from 'storybook/internal/types';

import * as pathe from 'pathe';
import * as pico from 'picomatch';
// eslint-disable-next-line depend/ban-dependencies
import slash from 'slash';

import { globToRegexp } from './glob-to-regexp.ts';
import { normalizeStoryPath } from './paths.ts';

const DEFAULT_TITLE_PREFIX = '';
export const DEFAULT_FILES_PATTERN = '**/*.@(mdx|stories.@(js|jsx|mjs|ts|tsx))';

const isDirectory = (configDir: string, entry: string) => {
  try {
    return lstatSync(resolve(configDir, entry)).isDirectory();
  } catch (err) {
    return false;
  }
};

export const getDirectoryFromWorkingDir = ({
  configDir,
  workingDir,
  directory,
}: NormalizeOptions & { directory: string }) => {
  const directoryFromConfig = resolve(configDir, directory);
  const directoryFromWorking = relative(workingDir, directoryFromConfig);

  // relative('/foo', '/foo/src') => 'src'
  // but we want `./src` to match importPaths
  return normalizeStoryPath(directoryFromWorking);
};

type SpecifierPathPrefix = [importPathPrefix: string, specifierPathPrefix: string];

/**
 * Map import path prefixes to their form through the specifier directory, longest first.
 *
 * Only a working dir inside the directory has any: with the working dir `core` inside the directory
 * `..`, `./` maps to `../core/` and `../` to itself.
 */
export const getSpecifierPathPrefixes = (
  { directory }: Pick<NormalizedStoriesSpecifier, 'directory'>,
  workingDir: string
): SpecifierPathPrefix[] => {
  const segments = pathe.relative(pathe.resolve(workingDir, directory), workingDir).split('/');
  if (segments[0] === '' || segments[0] === '..') {
    return [];
  }
  return [...segments, ''].map((_, i): SpecifierPathPrefix => {
    const up = segments.length - i;
    return [up ? '../'.repeat(up) : './', `${[directory, ...segments.slice(0, i)].join('/')}/`];
  });
};

/**
 * Write an import path through the specifier directory, as `importPathMatcher` and auto-titles
 * expect.
 */
export const toSpecifierPath = (
  specifier: Pick<NormalizedStoriesSpecifier, 'directory'>,
  importPath: string,
  workingDir: string
) => {
  const prefix = getSpecifierPathPrefixes(specifier, workingDir).find(([from]) =>
    importPath.startsWith(from)
  );
  return prefix ? prefix[1] + importPath.slice(prefix[0].length) : importPath;
};

export const matchesSpecifier = (
  specifier: NormalizedStoriesSpecifier,
  importPath: string,
  workingDir: string
) => specifier.importPathMatcher.test(toSpecifierPath(specifier, importPath, workingDir));

export const normalizeStoriesEntry = (
  entry: StoriesEntry,
  { configDir, workingDir, defaultFilesPattern = DEFAULT_FILES_PATTERN }: NormalizeOptions
): NormalizedStoriesSpecifier => {
  let specifierWithoutMatcher: Omit<NormalizedStoriesSpecifier, 'importPathMatcher'>;

  if (typeof entry === 'string') {
    const globResult = pico.scan(entry);
    if (globResult.isGlob) {
      const directory = globResult.prefix + globResult.base;
      const files = globResult.glob;

      specifierWithoutMatcher = {
        titlePrefix: DEFAULT_TITLE_PREFIX,
        directory,
        files,
      };
    } else if (isDirectory(configDir, entry)) {
      specifierWithoutMatcher = {
        titlePrefix: DEFAULT_TITLE_PREFIX,
        directory: entry,
        files: defaultFilesPattern,
      };
    } else {
      specifierWithoutMatcher = {
        titlePrefix: DEFAULT_TITLE_PREFIX,
        directory: dirname(entry),
        files: basename(entry),
      };
    }
  } else {
    specifierWithoutMatcher = {
      titlePrefix: DEFAULT_TITLE_PREFIX,
      files: defaultFilesPattern,
      ...entry,
    };
  }

  // We are going to be doing everything with node importPaths which use
  // URL format, i.e. `/` as a separator, so let's make sure we've normalized
  const files = slash(specifierWithoutMatcher.files);

  // At this stage `directory` is relative to `main.js` (the config dir)
  // We want to work relative to the working dir, so we transform it here.
  const { directory: directoryRelativeToConfig } = specifierWithoutMatcher;

  const directory = slash(
    getDirectoryFromWorkingDir({
      configDir,
      workingDir,
      directory: directoryRelativeToConfig,
    })
  ).replace(/\/$/, '');

  // Now make the importFn matcher.
  const importPathMatcher = globToRegexp(`${directory}/${files}`);

  return {
    ...specifierWithoutMatcher,
    directory,
    importPathMatcher,
  };
};

interface NormalizeOptions {
  configDir: string;
  workingDir: string;
  defaultFilesPattern?: string;
}

export const normalizeStories = (entries: StoriesEntry[], options: NormalizeOptions) => {
  if (!entries || (Array.isArray(entries) && entries.length === 0)) {
    throw new InvalidStoriesEntryError();
  }

  return entries.map((entry) => normalizeStoriesEntry(entry, options));
};
