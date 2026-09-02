import type { Cell, CellGap, CellReason } from './cells.ts';
import type { ResolvedCase } from './resolve.ts';
import { PLAIN_STYLE, type OutputStyle } from '../style.ts';

/** One table row: a cell's gap, or its complete state. */
export interface CellStatus {
  case: ResolvedCase;
  workflow: string;
  have: number;
  need: number;
  reason: CellReason;
}

/** Every cell as a table row, in cell order: its gap, or a complete line. */
export function cellStatuses(cells: Cell[], gaps: CellGap[], need: number): CellStatus[] {
  return cells.map(
    (cell) =>
      gaps.find(
        (gap) => gap.case.caseName === cell.case.caseName && gap.workflow === cell.workflow
      ) ?? {
        case: cell.case,
        workflow: cell.workflow,
        have: cell.runs.length,
        need,
        reason: 'complete',
      }
  );
}

/**
 * Padded, aligned table body shared by every cell-shaped status table: bold
 * headers, plain-text width computation (so ANSI escapes from `styleCell`
 * never skew alignment), and the last column never padded (nothing follows
 * it on the line). `styleCell` styles one data cell given its row and column
 * index; column 0 is left to the caller too, so each table can decide
 * whether it holds a case name.
 */
export function formatStatusTable(
  headers: readonly string[],
  rows: readonly string[][],
  styleCell: (rowIndex: number, col: number, value: string) => string,
  style: OutputStyle = PLAIN_STYLE
): string {
  const all = [headers, ...rows];
  const widths = headers.map((_, col) => Math.max(...all.map((row) => row[col]!.length)));
  const lastCol = widths.length - 1;
  return all
    .map((row, rowIndex) => {
      const padded = row.map((value, col) =>
        col === lastCol ? value : value.padEnd(widths[col]!)
      );
      if (rowIndex === 0) return padded.map((cell) => style.bold(cell)).join('  ');
      return padded.map((cell, col) => styleCell(rowIndex - 1, col, cell)).join('  ');
    })
    .join('\n');
}

export function formatCellTable(
  statuses: readonly CellStatus[],
  style: OutputStyle = PLAIN_STYLE
): string {
  return formatStatusTable(
    ['case', 'workflow', 'runs', 'reason'],
    statuses.map((status) => [
      status.case.shortName,
      status.workflow,
      `${status.have}/${status.need}`,
      status.reason,
    ]),
    (rowIndex, col, cell) => {
      if (col === 0) return style.caseName(cell);
      if (col === 3) return style.reason(statuses[rowIndex]!.reason, cell);
      return cell;
    },
    style
  );
}

export function remediationCommands(gaps: CellGap[]): string[] {
  const collect = new Map<string, { workflows: Set<string>; need: number }>();
  const analyze = new Set<string>();
  for (const gap of gaps) {
    // A bundled arm's gap can only be closed through its real constituent
    // experiments; the synthetic experiment name is not collectable.
    for (const experiment of gap.case.pooledExperiments ?? [gap.case.experiment]) {
      if (gap.reason === 'unanalyzed') {
        analyze.add(experiment);
      } else {
        // missing-runs and superseded-runs both mean data collection is necessary.
        const entry = collect.get(experiment) ?? { workflows: new Set(), need: 0 };
        entry.workflows.add(gap.workflow);
        entry.need = Math.max(entry.need, gap.need);
        collect.set(experiment, entry);
      }
    }
  }
  // Freshly collected runs land unanalyzed, so every experiment earning a
  // collection command also needs an analyze follow-up.
  for (const experiment of collect.keys()) {
    analyze.add(experiment);
  }
  return [
    ...[...collect.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([experiment, { workflows, need }]) =>
          `AGENTIC_REF_FLOW=${[...workflows].sort().join(',')} AGENTIC_REF_RUNS=${need} yarn workspace agent-eval run eval:agentic-ref ${experiment}`
      ),
    ...[...analyze]
      .sort()
      .map((e) => `yarn workspace agent-eval run results:analyze --experiment=${e}`),
  ];
}
