import { posix, win32 } from 'node:path';

import { normalize } from 'pathe';

import type { ReverseIndex } from './engine/dependency-graph/types.ts';

/** JSON-serializable reverse index shape stored in open-service state. */
export type StoriesByFileRecord = Record<string, Record<string, number>>;

export type ErrorLike = {
  message: string;
  name?: string;
  stack?: string;
  cause?: ErrorLike;
};

export type ModuleGraphStatus =
  | { value: 'booting' }
  | { value: 'ready' }
  | { value: 'error'; error: ErrorLike }
  | { value: 'unavailable'; reason: string; error?: ErrorLike };

export type ModuleGraphServiceState = {
  /** Project root used to normalize absolute file paths in query inputs. */
  workingDir: string;
  status: ModuleGraphStatus;
  graphRevision: number;
  storiesByFile: StoriesByFileRecord;
  /**
   * Per-story revision stamps keyed by story-index-style relative path. Each entry holds the
   * {@link graphRevision} at which that story's subgraph last changed. Seeded to `0` for every
   * story at snapshot time so scoped `graphRevision` reads observe existing keys.
   */
  storyChangeRevisions: Record<string, number>;
  latestChangedStoryFiles: string[];
};

export function errorToErrorLike(error: unknown): ErrorLike {
  if (!(error instanceof Error)) {
    return { message: String(error) };
  }

  return {
    message: error.message,
    name: error.name,
    stack: error.stack,
    cause: error.cause === undefined ? undefined : errorToErrorLike(error.cause),
  };
}

function isWindowsAbsolutePath(path: string): boolean {
  return win32.isAbsolute(path);
}

function isPosixAbsolutePath(path: string): boolean {
  return posix.isAbsolute(path);
}

function normalizePathSeparators(path: string): string {
  return path.replace(/\\/g, '/');
}

function formatStoryIndexPath(path: string): string {
  const withoutDotSlash = path.startsWith('./') ? path.slice(2) : path;
  const normalized = normalizePathSeparators(normalize(withoutDotSlash));

  if (normalized === '.' || normalized.startsWith('../')) {
    return normalized;
  }

  return `./${normalized}`;
}

/**
 * Converts absolute or relative file paths into the same relative import-path format used by the
 * story index (`./src/Button.stories.tsx`). This is the storage format for module-graph service
 * state so static snapshots do not leak machine-specific filesystem roots.
 */
export function toStoryIndexPath(path: string, workingDir: string): string {
  if (isWindowsAbsolutePath(path)) {
    return formatStoryIndexPath(win32.relative(workingDir, path));
  }

  const slashPath = normalizePathSeparators(path);
  if (isPosixAbsolutePath(slashPath)) {
    return formatStoryIndexPath(posix.relative(normalizePathSeparators(workingDir), slashPath));
  }

  return formatStoryIndexPath(slashPath);
}

export function storyIndexPathToAbsolutePath(path: string, workingDir: string): string {
  if (isWindowsAbsolutePath(path) || isPosixAbsolutePath(normalizePathSeparators(path))) {
    return normalizePathSeparators(normalize(path));
  }

  return normalizePathSeparators(normalize(posix.join(normalizePathSeparators(workingDir), path)));
}

export function reverseIndexToStoriesByFile(
  index: ReverseIndex,
  workingDir: string
): StoriesByFileRecord {
  const result: StoriesByFileRecord = {};
  for (const [dep, stories] of index) {
    result[toStoryIndexPath(dep, workingDir)] = Object.fromEntries(
      Array.from(stories, ([storyFile, depth]) => [toStoryIndexPath(storyFile, workingDir), depth])
    );
  }
  return result;
}

export type GraphUpdatePayload = {
  storiesByFile: StoriesByFileRecord;
  bumpedStoryFiles: string[];
};
