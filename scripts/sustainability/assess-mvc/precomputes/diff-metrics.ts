import type { PrContext } from '../types.ts';

export interface DiffMetrics {
  filesChanged: number;
  added: number;
  removed: number;
  net: number;
  files: string[];
}

export function computeDiffMetrics(files: PrContext['files']): DiffMetrics {
  let added = 0;
  let removed = 0;
  for (const f of files) {
    added += f.additions;
    removed += f.deletions;
  }
  return {
    filesChanged: files.length,
    added,
    removed,
    net: added - removed,
    files: files.map((f) => f.path),
  };
}
