import { existsSync } from 'node:fs';

import type { StoryIndex, StoryIndexEntry } from 'storybook/internal/types';

import { isAbsolute, normalize, relative, resolve } from 'pathe';

import { findStoriesByComponent } from './find-by-component.ts';
import type { ModuleGraphAccess } from './resolve-component-stories.ts';

/**
 * How a file argument selected its stories.
 *
 * - `story-file`: the file is in the story index; every story it declares, and nothing else.
 * - `component`: any other file; every story whose story file imports it, at any depth.
 */
export type FileSelectionKind = 'story-file' | 'component';

export type FoundFileStories = {
  /** The file as the caller passed it. */
  file: string;
  kind: FileSelectionKind;
  /** Story index entry ids, in index order for a story file and by import depth for a component. */
  storyIds: string[];
  /** The story files these stories live in, as story index import paths. */
  storyFiles: string[];
};

export type NotFoundFileStories = {
  file: string;
  errorMessage: string;
};

export type FindStoriesInFilesResult = FoundFileStories | NotFoundFileStories;

export type FindStoriesInFilesParams = {
  files: string[];
  index: StoryIndex;
  /**
   * Called only when a file is not a story file. Returns `undefined` when this realm has no module
   * graph, which the result reports instead of claiming the file has no stories.
   */
  getModuleGraph: () => ModuleGraphAccess | undefined;
  /** The directory story index import paths are relative to. Defaults to `process.cwd()`. */
  workingDir?: string;
};

function toImportPathKey(importPath: string): string {
  const normalized = normalize(importPath);
  return normalized.startsWith('./') || normalized.startsWith('../')
    ? normalized
    : `./${normalized}`;
}

function storyEntriesByFile(index: StoryIndex): Map<string, StoryIndexEntry[]> {
  const byFile = new Map<string, StoryIndexEntry[]>();
  for (const entry of Object.values(index.entries)) {
    if (entry.type !== 'story' || entry.importPath.startsWith('virtual:')) {
      continue;
    }
    const key = toImportPathKey(entry.importPath);
    byFile.set(key, [...(byFile.get(key) ?? []), entry]);
  }
  return byFile;
}

/**
 * Resolves file arguments to the stories they select, the way test runners treat file arguments: a
 * story file selects its own stories, and any other file selects the stories that depend on it.
 *
 * Relative paths resolve against `workingDir`. Story files need only the story index; the module
 * graph is consulted only for the other files.
 */
export async function findStoriesInFiles({
  files,
  index,
  getModuleGraph,
  workingDir = process.cwd(),
}: FindStoriesInFilesParams): Promise<FindStoriesInFilesResult[]> {
  const byFile = storyEntriesByFile(index);
  const results: FindStoriesInFilesResult[] = [];
  const componentFiles: { position: number; file: string; absolute: string; shown: string }[] = [];

  // Messages name the file relative to the project, as agents pass it; the CLI sends absolute paths.
  const display = (absolute: string) => {
    const fromRoot = relative(workingDir, absolute);
    return fromRoot.startsWith('..') ? absolute : fromRoot;
  };

  files.forEach((file, position) => {
    const absolute = isAbsolute(file) ? normalize(file) : resolve(workingDir, file);
    const entries = byFile.get(toImportPathKey(relative(workingDir, absolute)));
    if (entries) {
      const storyFile = entries[0].importPath;
      results[position] = {
        file,
        kind: 'story-file',
        storyIds: entries.map((entry) => entry.id),
        storyFiles: [storyFile],
      };
    } else if (!existsSync(absolute)) {
      results[position] = { file, errorMessage: `No file found at ${display(absolute)}.` };
    } else {
      componentFiles.push({ position, file, absolute, shown: display(absolute) });
    }
  });

  if (componentFiles.length === 0) {
    return results;
  }

  const lookup = await findStoriesByComponent({
    componentPaths: componentFiles.map(({ absolute }) => absolute),
    // Every dependent story, like `vitest related`: a test run that skips distant consumers would
    // pass while they break.
    maxDistance: Number.POSITIVE_INFINITY,
    index,
    moduleGraph: getModuleGraph(),
  });

  componentFiles.forEach(({ position, file, shown }, componentIndex) => {
    if (!lookup.available) {
      results[position] = {
        file,
        errorMessage: `${shown} is not a story file, and finding the stories that depend on it needs Storybook's module graph: ${lookup.reason}`,
      };
      return;
    }
    const matches = lookup.results[componentIndex]?.matches ?? [];
    if (matches.length === 0) {
      results[position] = {
        file,
        errorMessage: `No stories found for ${shown}: it is not a story file in the Storybook index, and no story imports it. Check the path, and that story files match the \`stories\` globs in the Storybook config.`,
      };
      return;
    }
    results[position] = {
      file,
      kind: 'component',
      storyIds: matches.map((match) => match.storyId),
      storyFiles: [...new Set(matches.map((match) => match.importPath))],
    };
  });

  return results;
}
