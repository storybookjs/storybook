import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { facetMetricKey, UNCATEGORISED } from '../facets.ts';

import { isCurrentRun } from '../comparability.ts';
import { dsDocsRefLabel } from '../metrics/ds-misuse/ds-docs.ts';
import { isStale, readMisuseReport } from '../metrics/ds-misuse/index.ts';

import type { DsMisuseReport } from '../metrics/ds-misuse/types.ts';
import type { Run } from '../../post-analysis/discovery.ts';
import { isCurrentCacheEntry, readCacheEntry } from '../../post-analysis/run-cache.ts';
import { readJson } from '../../utils/files.ts';
import type { ResolvedCase } from './resolve.ts';

export type ExclusionReason = 'infra-failure' | 'malformed-analysis';
export type GapReason = 'missing-runs' | 'unanalyzed' | 'superseded-runs';
/** A gap's reason, or 'complete' for a cell that meets the gate. */
export type CellReason = GapReason | 'complete';

export interface ExcludedRun {
  runDir: string;
  reason: ExclusionReason;
}

export interface UsableRun {
  run: Run;
  analysis: Record<string, unknown>;
}

// A cell pools every batch of its (case, workflow) pair: a sample is topped
// up across invocations, and the per-run supersession check already keeps
// runs of replaced measurements out, which is what batch selection was for.
export interface Cell {
  case: ResolvedCase;
  workflow: string;
  runs: UsableRun[];
  excluded: ExcludedRun[];
  unanalyzed: number;
  /** Runs measuring something this cell no longer measures (see ../comparability.ts). */
  superseded: number;
  passed: number;
  failed: number;
}

export interface CellGap {
  case: ResolvedCase;
  workflow: string;
  have: number;
  need: number;
  reason: GapReason;
}

interface BuildOptions {
  runs: Run[];
  cases: ResolvedCase[];
  workflows: string[];
  minRuns: number;
  metricsVersion: number | undefined;
}

function classify(run: Run, metricsVersion: number | undefined, cell: Cell) {
  if (!isCurrentRun(run.runDir, run)) {
    cell.superseded += 1;
    return;
  }
  const result = readJson<{ status?: string }>(join(run.runDir, 'result.json'));
  if (result?.status === 'passed') cell.passed += 1;
  else if (result?.status === 'failed') cell.failed += 1;
  const analysisPath = join(run.runDir, 'analysis.json');
  if (!existsSync(analysisPath)) {
    if (result?.status === 'failed') {
      cell.excluded.push({ runDir: run.runDir, reason: 'infra-failure' });
    } else {
      cell.unanalyzed += 1;
    }
    return;
  }
  const analysis = readJson<Record<string, unknown>>(analysisPath);
  if (analysis === null) {
    cell.excluded.push({ runDir: run.runDir, reason: 'malformed-analysis' });
    return;
  }
  // An analysis stamped by older metrics code counts as not yet analyzed:
  // the analyzer's version-aware cache recomputes it on a plain pass.
  if (!isCurrentCacheEntry(readCacheEntry(run.runDir), metricsVersion)) {
    cell.unanalyzed += 1;
    return;
  }
  attachMisuse(analysis, run.runDir);
  cell.runs.push({ run, analysis });
}

/**
 * Per-node score means pooled over one run's judgement, plus the aggregate:
 * every answered question's score over the number of answers, so a run is
 * normalised by how much it was judged on rather than rewarded or punished
 * for the size of its diff. Also keys a mean per cited documentation facet
 * (see the returned `facets` field), pooling an answer into every distinct
 * facet its reasons cite — and into 'uncategorised' too, when one of its
 * reasons cites none.
 */
function misuseValues(report: DsMisuseReport) {
  let sum = 0;
  let answers = 0;
  const facetAcc = new Map<string, { sum: number; n: number }>();
  for (const node of report.nodes) {
    for (const answer of [node.correctDsDecision, node.correctDsUsage, node.correctLocalDecision]) {
      if (answer === undefined) continue;
      sum += answer.score;
      answers += 1;
      const cited = new Set<string>();
      for (const reason of answer.reasons) cited.add(reason.facet ?? UNCATEGORISED);
      for (const facet of cited) {
        const acc = facetAcc.get(facet) ?? { sum: 0, n: 0 };
        acc.sum += answer.score;
        acc.n += 1;
        facetAcc.set(facet, acc);
      }
    }
  }
  return {
    score: answers === 0 ? null : sum / answers,
    correctDsDecision: report.summary.correctDsDecision,
    correctDsUsage: report.summary.correctDsUsage,
    correctLocalDecision: report.summary.correctLocalDecision,
    // How much judgement stands behind the means above: nodes the judge
    // actually scored, and the pooled answer count the aggregate was
    // normalised over.
    evaluated: report.summary.evaluated,
    answers,
    // Mean score per cited facet, keyed by the sanitized id the metric
    // registry paths use. Absent (not 0) when no answer cited the facet, so
    // an unjudged facet never drags a mean.
    facets: Object.fromEntries(
      [...facetAcc].map(([facet, acc]) => [facetMetricKey(facet), acc.sum / acc.n])
    ),
  };
}

/**
 * Judgements live beside the analysis, not inside it: analysis.json is a pure
 * function of the run, while ds-misuse.json appears whenever the paid judge
 * pass happens to run. Grafting at cell-build time keeps the dataset current
 * with the artifacts on disk — and a stale judgement (moved guideline pin or
 * metrics version) is left off entirely, because a number scored against a
 * different standard is worse in a table than a blank.
 */
function attachMisuse(analysis: Record<string, unknown>, runDir: string): void {
  const report = readMisuseReport(runDir);
  if (report === null || isStale(report, { dsGuidelinesRef: dsDocsRefLabel() })) {
    return;
  }
  analysis.dsMisuse = misuseValues(report);
}

export function buildCells(options: BuildOptions): { cells: Cell[]; gaps: CellGap[] } {
  const cells: Cell[] = [];
  const gaps: CellGap[] = [];
  for (const resolvedCase of options.cases) {
    for (const workflow of options.workflows) {
      const candidates = options.runs.filter(
        (run) => run.experiment === resolvedCase.experiment && run.evalName === workflow
      );
      const cell: Cell = {
        case: resolvedCase,
        workflow,
        runs: [],
        excluded: [],
        unanalyzed: 0,
        superseded: 0,
        passed: 0,
        failed: 0,
      };
      for (const run of candidates.sort(
        (a, b) => a.timestamp.localeCompare(b.timestamp) || a.run - b.run
      )) {
        classify(run, options.metricsVersion, cell);
      }
      cells.push(cell);
      if (cell.runs.length < options.minRuns) {
        const shortfall = options.minRuns - cell.runs.length;
        // Re-analyzing is free, collecting is not: name unanalyzed when the
        // analyzer alone could close the gap, superseded-runs when stored
        // data was disqualified, missing-runs when there never was enough.
        const reason: GapReason =
          cell.unanalyzed >= shortfall
            ? 'unanalyzed'
            : cell.superseded + cell.unanalyzed >= shortfall
              ? 'superseded-runs'
              : 'missing-runs';
        gaps.push({
          case: resolvedCase,
          workflow,
          have: cell.runs.length,
          need: options.minRuns,
          reason,
        });
      }
    }
  }
  return { cells, gaps };
}

/** Strict intersection: keep candidates where every case meets the gate. */
export function autoSelectWorkflows(
  options: Omit<BuildOptions, 'workflows'> & { candidates: string[] }
) {
  const { candidates, ...rest } = options;
  const selected: string[] = [];
  const skipped: { workflow: string; gaps: CellGap[] }[] = [];
  for (const workflow of candidates) {
    const { gaps } = buildCells({ ...rest, workflows: [workflow] });
    if (gaps.length === 0) selected.push(workflow);
    else skipped.push({ workflow, gaps });
  }
  return { selected, skipped };
}
