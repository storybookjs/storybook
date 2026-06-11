import type { PrContext } from '../../types.ts';

/**
 * Diff-size precompute for Check 4 (cost/benefit). Pure / cheap; no I/O.
 *
 * We want net LOC, not just additions or just deletions: a PR that deletes
 * 300 lines and adds 30 is structurally smaller than one that adds 30 with no
 * deletions, even though both "add 30 lines". `files` is preserved so the
 * cost/benefit prompt can mention path patterns that may signal scope (e.g.,
 * lots of test-file paths suggest test churn rather than runtime risk).
 */
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
