import { posix, win32 } from 'node:path';

import { normalize } from 'pathe';

import { slash } from '../../../utils/paths.ts';

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
  /**
   * Monotonic counter advanced on every processed file-change event, including out-of-graph
   * paths that do not advance {@link graphRevision}. Change detection watches this to rescan
   * git; review staleness keeps watching {@link graphRevision} (in-graph only).
   */
  fileActivityRevision: number;
  /**
   * Per-story revision stamps keyed by story-index-style relative path. Each entry holds the
   * {@link graphRevision} at which that story's subgraph last changed. Seeded to `0` for every
   * story at snapshot time so scoped `graphRevision` reads observe existing keys.
   */
  storyChangeRevisions: Record<string, number>;
  latestChangedStoryFiles: string[];
  /**
   * Change-detection scan readiness. Distinct from {@link status}: the graph can be ready while
   * scanning is disabled or has failed. `pending` is the value before the first scan settles.
   */
  changeDetectionReadiness: ChangeDetectionReadinessState;
};

export type ChangeDetectionReadinessState =
  | { status: 'pending' }
  | { status: 'ready' }
  | { status: 'unavailable'; reason: string; error?: { message: string } }
  | { status: 'error'; error: { message: string } };

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

function formatStoryIndexPath(path: string): string {
  const withoutDotSlash = path.startsWith('./') ? path.slice(2) : path;
  const normalized = slash(normalize(withoutDotSlash));

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

  const slashPath = slash(path);
  if (isPosixAbsolutePath(slashPath)) {
    return formatStoryIndexPath(posix.relative(slash(workingDir), slashPath));
  }

  return formatStoryIndexPath(slashPath);
}

export function storyIndexPathToAbsolutePath(path: string, workingDir: string): string {
  if (isWindowsAbsolutePath(path) || isPosixAbsolutePath(slash(path))) {
    return slash(normalize(path));
  }

  return slash(normalize(posix.join(slash(workingDir), path)));
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
