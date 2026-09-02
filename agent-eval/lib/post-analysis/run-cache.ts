import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { dim } from '../utils/colors.ts';
import { readJson } from '../utils/files.ts';

// One entry per run, stored next to the other artifacts; --recompute ignores it.
export const CACHE_FILENAME = 'post-analysis-meta.json';

export interface CacheEntry {
  analyzedAt: string;
  /** The metrics code version that produced `output`; absent on legacy entries. */
  metricsVersion?: number;
  output: Record<string, unknown> | null;
}

export function readCacheEntry(runDir: string): CacheEntry | null {
  return readJson(join(runDir, CACHE_FILENAME));
}

/** A cached analysis counts only when the current metrics code produced it. */
export function isCurrentCacheEntry(
  entry: CacheEntry | null,
  metricsVersion: number | undefined
): entry is CacheEntry {
  return entry !== null && entry.metricsVersion === metricsVersion;
}

export function writeCacheEntry(
  runDir: string,
  output: Record<string, unknown> | null,
  metricsVersion: number | undefined
) {
  console.log(dim(`Writing ${CACHE_FILENAME} for ${runDir}`));
  const entry: CacheEntry = { analyzedAt: new Date().toISOString(), output };
  if (metricsVersion !== undefined) entry.metricsVersion = metricsVersion;
  writeFileSync(join(runDir, CACHE_FILENAME), JSON.stringify(entry, null, 2) + '\n');
}
