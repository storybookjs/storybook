import { existsSync, realpathSync } from 'node:fs';

import type { StoryIndex, StoryIndexEntry } from 'storybook/internal/types';

import { basename, isAbsolute, join, normalize, relative, resolve } from 'pathe';

import { findStoriesByComponent } from './find-by-component.ts';
import type { ModuleGraphAccess } from './resolve-component-stories.ts';

/** Story files and the stories in them, as story index import paths and entry ids. */
export type StorySelection = { storyFiles: string[]; storyIds: string[] };

function storyEntriesByFile(
  index: StoryIndex,
  workingDir: string,
  toKey: (file: string) => string = (file) => file
): Map<string, StoryIndexEntry[]> {
  const byFile = new Map<string, StoryIndexEntry[]>();
  for (const entry of Object.values(index.entries)) {
    if (entry.type !== 'story' || entry.importPath.startsWith('virtual:')) {
      continue;
    }
    const file = toKey(resolve(workingDir, entry.importPath));
    byFile.set(file, [...(byFile.get(file) ?? []), entry]);
  }
  return byFile;
}

function toSelection(files: string[], byFile: Map<string, StoryIndexEntry[]>): StorySelection {
  const entries = files.flatMap((file) => byFile.get(file) ?? []);
  return {
    storyFiles: [...new Set(entries.map((entry) => entry.importPath))],
    storyIds: entries.map((entry) => entry.id),
  };
}

/**
 * Story files matching any filter, the way Vitest matches its file filters against test files: a
 * case-insensitive substring of the path relative to `cwd`, or, for an absolute filter, a path
 * prefix (a file or a directory). A filter that matches nothing is ignored.
 */
export function filterStoryFiles({
  index,
  filters,
  cwd = process.cwd(),
  workingDir = process.cwd(),
}: {
  index: StoryIndex;
  filters: string[];
  /** The directory filters are relative to, as Vitest's `process.cwd()`. */
  cwd?: string;
  /** The directory story index import paths are relative to. */
  workingDir?: string;
}): StorySelection {
  const byFile = storyEntriesByFile(index, workingDir);
  const matched = [...byFile.keys()].filter((file) => {
    const fromCwd = relative(cwd, file).toLocaleLowerCase();
    return filters.some((rawFilter) => {
      const filter = normalize(rawFilter);
      if (isAbsolute(filter) && file.startsWith(filter)) {
        return true;
      }
      const fromCwdFilter = rawFilter.endsWith('/')
        ? join(relative(cwd, filter), '/')
        : relative(cwd, filter);
      return (
        fromCwd.includes(filter.toLocaleLowerCase()) ||
        fromCwd.includes(fromCwdFilter.toLocaleLowerCase())
      );
    });
  });
  return toSelection(matched, byFile);
}

/** Changes to these rerun every story, as Vitest's default `forceRerunTriggers`. */
function isRerunTrigger(file: string): boolean {
  const name = basename(file);
  return name === 'package.json' || /^(vite|vitest)\.config\./.test(name);
}

export type ChangedStories =
  | { kind: 'every-story'; trigger: string }
  | ({ kind: 'stories' } & StorySelection)
  | { kind: 'unavailable'; reason: string };

function canonical(file: string): string {
  try {
    return normalize(realpathSync.native(file));
  } catch {
    return file;
  }
}

/**
 * The stories that changed files affect, the way Vitest selects tests for `--changed`: a changed
 * story file selects its stories, and any other changed file selects the stories whose story files
 * import it, at any depth. A changed file that affects every story — what the preview loads, or one
 * of Vitest's rerun triggers — selects every story. Deleted files select nothing.
 */
export async function findChangedStories({
  index,
  changedFiles,
  getModuleGraph,
  workingDir = process.cwd(),
}: {
  index: StoryIndex;
  /** Absolute paths. */
  changedFiles: string[];
  getModuleGraph: () => ModuleGraphAccess | undefined;
  workingDir?: string;
}): Promise<ChangedStories> {
  // Git reports real paths from the repository root; the index is relative to the working directory,
  // which may be reached through a symlink. Both sides are compared as real paths.
  const byFile = storyEntriesByFile(index, workingDir, canonical);
  const files = [...new Set(changedFiles.map((file) => canonical(normalize(file))))];
  const trigger = files.find(isRerunTrigger);
  if (trigger) {
    return { kind: 'every-story', trigger };
  }

  const storyFiles = files.filter((file) => byFile.has(file));
  const otherFiles = files.filter((file) => !byFile.has(file) && existsSync(file));
  const selected = new Set(storyFiles);

  if (otherFiles.length > 0) {
    const moduleGraph = getModuleGraph();
    const lookup = await findStoriesByComponent({
      componentPaths: otherFiles,
      maxDistance: Number.POSITIVE_INFINITY,
      index,
      moduleGraph,
    });
    if (!lookup.available) {
      return { kind: 'unavailable', reason: lookup.reason };
    }
    const previewLoaded = await isLoadedByPreview(moduleGraph, otherFiles);
    const previewFile = otherFiles.find((_, position) => previewLoaded[position]);
    if (previewFile) {
      return { kind: 'every-story', trigger: previewFile };
    }
    for (const result of lookup.results) {
      for (const match of result.matches) {
        selected.add(canonical(resolve(workingDir, match.importPath)));
      }
    }
  }

  return { kind: 'stories', ...toSelection([...selected], byFile) };
}

/**
 * Whether the preview loads each file, asked with both the given and the real path, as the graph
 * keys files by their real path. A graph that cannot answer (an older instance, a preset that
 * throws) leaves every file to the import lookup.
 */
async function isLoadedByPreview(
  moduleGraph: ModuleGraphAccess | undefined,
  files: string[]
): Promise<boolean[]> {
  const query = moduleGraph?.queries.loadedByPreview;
  if (!query) {
    return [];
  }
  try {
    const answers = await query.loaded({ files: [...files, ...files.map(canonical)] });
    return files.map((_, position) =>
      Boolean(answers[position] || answers[files.length + position])
    );
  } catch {
    return [];
  }
}
