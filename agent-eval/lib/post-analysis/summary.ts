// Writing analysis rows back into an eval's summary.json.
//
// summary.json sits beside the run-* directories and belongs to the harness:
// totalRuns, passedRuns, passRate, meanDuration for that eval. The analysis rows
// go in alongside those under `postAnalysis` rather than replacing the file, so
// both survive.
//
// The harness rewrites this file whenever the eval runs, dropping the added key
// — so `yarn workspace agent-eval run results:analyze` is what puts it back, and belongs after the eval
// rather than before it.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { readJson } from '../utils/files.ts';

import type { Analysis } from './types.ts';

export const EVAL_SUMMARY_FILENAME = 'summary.json';

/** The key the analysis rows land under, beside the harness's own fields. */
export const POST_ANALYSIS_KEY = 'postAnalysis';

/**
 * Merge `rows` into <evalDir>/summary.json, preserving everything already there.
 *
 * A missing or unreadable summary.json is written fresh rather than treated as
 * an error: the harness may never have produced one for an aborted eval, and
 * losing the analysis over that would be the worse trade.
 */
export function mergeIntoEvalSummary(evalDir: string, rows: Analysis[]): void {
  const path = join(evalDir, EVAL_SUMMARY_FILENAME);
  const existing = readJson<Record<string, unknown>>(path) ?? {};
  writeFileSync(path, JSON.stringify({ ...existing, [POST_ANALYSIS_KEY]: rows }, null, 2) + '\n');
}
