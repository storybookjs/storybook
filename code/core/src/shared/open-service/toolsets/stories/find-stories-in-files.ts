import { existsSync, realpathSync, statSync } from 'node:fs';

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

function canonical(absolute: string): string {
  return normalize(realpathSync.native(absolute));
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
 * graph is consulted only for the other files. A file passed twice, in any spelling, gets one
 * result.
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
  const seen = new Set<string>();

  // Messages name the file relative to the project, as agents pass it; the CLI sends absolute paths.
  const display = (absolute: string) => {
    const fromRoot = relative(workingDir, absolute);
    return fromRoot.startsWith('..') ? absolute : fromRoot;
  };
  const storyEntriesAt = (absolute: string) =>
    byFile.get(toImportPathKey(relative(workingDir, absolute)));

  for (const file of files) {
    const absolute = isAbsolute(file) ? normalize(file) : resolve(workingDir, file);
    // `src/A.tsx` and `./src/A.tsx` are one file, and select its stories once.
    if (seen.has(absolute)) {
      continue;
    }
    seen.add(absolute);
    const position = results.length;
    const exists = existsSync(absolute);
    // A wrong-case or symlinked path still names the indexed story file.
    const entries =
      storyEntriesAt(absolute) ?? (exists ? storyEntriesAt(canonical(absolute)) : undefined);
    if (entries) {
      results.push({
        file,
        kind: 'story-file',
        storyIds: entries.map((entry) => entry.id),
        storyFiles: [entries[0].importPath],
      });
    } else if (!exists) {
      const base = isAbsolute(file) ? '' : ` (relative paths resolve against ${workingDir})`;
      results.push({ file, errorMessage: `No file found at ${display(absolute)}${base}.` });
    } else if (statSync(absolute).isDirectory()) {
      results.push({
        file,
        errorMessage: `${display(absolute)} is a directory: pass the story files or component files in it.`,
      });
    } else {
      results.push({ file, errorMessage: '' });
      componentFiles.push({ position, file, absolute, shown: display(absolute) });
    }
  }

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

  // The paths are distinct, so the lookup answers them one to one and in order.
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
        errorMessage: `No stories found for ${shown}: it is not a story file in the Storybook index, and no story imports it. Check the path and the \`stories\` globs in the Storybook config. If the Storybook preview loads it (global styles, theme, decorators), run every story instead.`,
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
