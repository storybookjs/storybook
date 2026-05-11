// Resolves changed paths into reference Playwright spec absolute paths.
// Pure I/O at the edges (existence check); the matching algorithm itself
// is deterministic given the same TRIAGE_ROUTES table and inputs.

import * as fs from 'node:fs';
import * as path from 'node:path';

import { minimatch } from 'minimatch';

import { TRIAGE_ROUTES } from './recipes/triage-table.ts';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const E2E_TESTS_DIR = path.resolve(repoRoot, 'code/e2e-tests');

/**
 * Map a list of changed file paths (repo-relative) to absolute reference
 * spec paths under code/e2e-tests/. Accumulates all matching routes,
 * dedupes by absolute path while preserving insertion order, and skips
 * (with a warning) any reference spec that does not exist on disk.
 */
export function triageReferenceSpecs(changedPaths: string[]): string[] {
  const seen = new Set<string>();
  const resolved: string[] = [];

  for (const route of TRIAGE_ROUTES) {
    const matched = changedPaths.some((p) => minimatch(p, route.pathGlob));
    if (!matched) continue;

    for (const basename of route.referenceSpecs) {
      const abs = path.resolve(E2E_TESTS_DIR, basename);
      if (seen.has(abs)) continue;
      seen.add(abs);

      try {
        const stat = fs.statSync(abs);
        if (!stat.isFile()) {
          console.warn(`[triage] reference spec not a file, skipping: ${abs}`);
          continue;
        }
      } catch {
        console.warn(`[triage] reference spec missing, skipping: ${abs}`);
        continue;
      }

      resolved.push(abs);
    }
  }

  return resolved;
}

/**
 * Return the list of triage globs that matched the given changed paths.
 * Used for provenance metadata in the prompt bundle.
 */
export function matchedTriageGlobs(changedPaths: string[]): string[] {
  const result: string[] = [];
  for (const route of TRIAGE_ROUTES) {
    if (changedPaths.some((p) => minimatch(p, route.pathGlob))) {
      result.push(route.pathGlob);
    }
  }
  return result;
}
