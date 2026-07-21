import { readFileSync, statSync } from 'node:fs';

export const groupBy = <K extends PropertyKey, T>(
  items: T[],
  keySelector: (item: T, index: number) => K
) => {
  return items.reduce<Partial<Record<K, T[]>>>((acc = {}, item, index) => {
    const key = keySelector(item, index);
    if (!Array.isArray(acc[key])) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {});
};

// Per-path cache for text file reads. Entries are keyed by file path and validated against the
// file's `mtimeMs`, so an edited file is re-read on the next access. The docgen worker stays alive
// for the dev server's lifetime and extracts one component at a time (no "batch start" hook to
// invalidate from), so cache freshness has to be checked per read instead.
let textFileCache: Map<string, { mtimeMs: number; content: string }> = new Map();

export const invalidateCache = () => {
  textFileCache = new Map();
};

/**
 * Reads a UTF-8 text file, caching by path and invalidating when the file's `mtimeMs` changes.
 * When the file's mtime cannot be read it is re-read every time rather than risking a stale hit.
 */
export const cachedReadTextFileSync = (filePath: string): string => {
  let mtimeMs: number | undefined;
  try {
    mtimeMs = statSync(filePath).mtimeMs;
  } catch {
    mtimeMs = undefined;
  }

  if (mtimeMs !== undefined) {
    const entry = textFileCache.get(filePath);
    if (entry && entry.mtimeMs === mtimeMs) {
      return entry.content;
    }
  }

  const content = readFileSync(filePath, 'utf-8');
  if (mtimeMs !== undefined) {
    textFileCache.set(filePath, { mtimeMs, content });
  }
  return content;
};
