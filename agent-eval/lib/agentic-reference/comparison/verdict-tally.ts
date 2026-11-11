// Direction-aware partition of estimate rows into better/worse/changed/
// inconclusive, shared by the terminal digest (compare-results.ts) and the
// HTML report's per-case verdict counts, so both read "better" and "worse"
// off the same rule.
import type { EstimateDirection, EstimateRow } from './html-report.ts';

/** True when a row's effect moved the direction its metric calls "better". */
export function isBetter(value: number, direction: EstimateDirection): boolean {
  return value < 0 === (direction === 'lower-better');
}

export interface VerdictTally {
  better: EstimateRow[];
  worse: EstimateRow[];
  changed: EstimateRow[];
  inconclusive: EstimateRow[];
}

/**
 * Splits rows into better/worse/changed/inconclusive by direction, given a
 * caller-supplied significance test (FDR verdict or naive p-value) and the
 * per-row value whose sign decides direction (raw beta by default; a caller
 * may pass the display-scale effect instead).
 */
export function tallyVerdicts(
  rows: EstimateRow[],
  isSignificant: (row: EstimateRow) => boolean,
  valueOf: (row: EstimateRow) => number = (row) => row.beta
): VerdictTally {
  const better: EstimateRow[] = [];
  const worse: EstimateRow[] = [];
  const changed: EstimateRow[] = [];
  const inconclusive: EstimateRow[] = [];
  for (const row of rows) {
    if (!isSignificant(row)) inconclusive.push(row);
    else if (row.direction === 'neutral') changed.push(row);
    else if (isBetter(valueOf(row), row.direction)) better.push(row);
    else worse.push(row);
  }
  return { better, worse, changed, inconclusive };
}
