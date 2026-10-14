import { relative, sep } from 'node:path';

import { metricValueAt, type ComparisonMetric } from '../comparison-metrics.ts';
import type { Cell } from './cells.ts';
import { caseColors } from './colors.ts';
import type { ResolvedCase } from './resolve.ts';

export interface ComparisonSpec {
  control: ResolvedCase;
  treatments: ResolvedCase[];
  workflows: string[];
  mode: 'single-workflow' | 'aggregate';
  minRuns: number;
  /** Repo-relative path of the plan config that scoped this comparison, if one did. */
  plan?: string;
}

function orderedCells(cells: Cell[], spec: ComparisonSpec): Cell[] {
  const caseRank = (c: ResolvedCase) => (c.caseName === spec.control.caseName ? '' : c.caseName);
  const workflowNumericId = (workflow: string): number => {
    const match = workflow.match(/^(\d+)/);
    return match?.[1] ? Number.parseInt(match[1], 10) : 0;
  };
  return [...cells].sort(
    (a, b) =>
      caseRank(a.case).localeCompare(caseRank(b.case)) ||
      workflowNumericId(a.workflow) - workflowNumericId(b.workflow) ||
      a.workflow.localeCompare(b.workflow)
  );
}

export function datasetCsv(
  cells: Cell[],
  metrics: ComparisonMetric[],
  spec: ComparisonSpec
): string {
  const header = ['case', 'workflow', 'batch', 'run', ...metrics.map((m) => m.key)];
  const lines = [header.join(',')];
  for (const cell of orderedCells(cells, spec)) {
    for (const usable of [...cell.runs].sort(
      (a, b) => a.run.timestamp.localeCompare(b.run.timestamp) || a.run.run - b.run.run
    )) {
      const values = metrics.map((metric) => {
        const value = metricValueAt(usable.analysis, metric.path);
        return value === null ? '' : String(value);
      });
      lines.push(
        [
          cell.case.shortName,
          cell.workflow,
          usable.run.timestamp,
          String(usable.run.run),
          ...values,
        ].join(',')
      );
    }
  }
  return lines.join('\n') + '\n';
}

function toPosix(path: string): string {
  return path.split(sep).join('/');
}

export function manifestJson(args: {
  spec: ComparisonSpec;
  metrics: ComparisonMetric[];
  cells: Cell[];
  agentEvalRoot: string;
  provenance: Record<string, unknown>;
}): string {
  const { spec, metrics, cells, agentEvalRoot, provenance } = args;
  const ordered = orderedCells(cells, spec);
  const manifest = {
    spec: {
      control: spec.control,
      treatments: spec.treatments,
      workflows: spec.workflows,
      mode: spec.mode,
      minRuns: spec.minRuns,
      plan: spec.plan ?? null,
    },
    metrics,
    // The BH families: every headline test of this invocation, in test
    // order, tagged with the correction group it is corrected within.
    family: metrics.flatMap((metric) =>
      spec.treatments.map((treatment) => ({
        metric: metric.key,
        treatment: treatment.shortName,
        correctionGroup: metric.correctionGroup,
      }))
    ),
    // Stable per-case colors, shared by report.html and the ECDF curves.
    colors: caseColors([spec.control, ...spec.treatments].map((c) => c.shortName)),
    // Per-run batches live in the dataset; a cell here is the pooled sample.
    cells: ordered.map((cell) => ({
      case: cell.case.shortName,
      workflow: cell.workflow,
      usableRuns: cell.runs.length,
      passed: cell.passed,
      failed: cell.failed,
      unanalyzed: cell.unanalyzed,
      superseded: cell.superseded,
    })),
    excludedRuns: ordered.flatMap((cell) =>
      cell.excluded.map((excluded) => ({
        path: toPosix(relative(agentEvalRoot, excluded.runDir)),
        reason: excluded.reason,
      }))
    ),
    provenance,
  };
  return JSON.stringify(manifest, null, 2) + '\n';
}
