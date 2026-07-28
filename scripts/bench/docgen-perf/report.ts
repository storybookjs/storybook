/**
 * Rendering the suite's terminal output. Pure string building, so the one rule that matters here -
 * a ratio never appears without the caveat that applies to it - is testable.
 */
import type { EngineId, EngineMetrics, EngineResult, Ratios } from './types.ts';

const HEADER = ['engine/scenario', 'cold', 'warm', 'scan', 'peak', 'ret-growth', 'ret-slope'];

export function formatCell(metric: EngineMetrics[keyof EngineMetrics], unit: 'ms' | 'MB'): string {
  if (metric.status === 'n/a') {
    return 'n/a';
  }
  if ('median' in metric) {
    return `${metric.median.toFixed(0)}${unit}`;
  }
  if ('mean' in metric) {
    return `${metric.mean.toFixed(0)}${unit}`;
  }
  return `${metric.value.toFixed(unit === 'MB' ? 1 : 0)}${unit}`;
}

export interface RenderedResults {
  /** The metrics table, already padded into aligned lines. */
  table: string[];
  /** One line per engine that skipped or failed. */
  statusLines: string[];
}

export function renderResults(
  engineIds: EngineId[],
  results: Partial<Record<EngineId, EngineResult>>
): RenderedResults {
  const rows: string[][] = [HEADER];
  const statusLines: string[] = [];

  for (const engineId of engineIds) {
    const result = results[engineId];
    if (!result) {
      continue;
    }
    if (result.status !== 'measured') {
      statusLines.push(
        `  ${engineId}: ${result.status.toUpperCase()} - ${result.reason.split('\n')[0]}`
      );
      continue;
    }
    for (const [scenarioName, scenario] of Object.entries(result.scenarios)) {
      const m = scenario.metrics;
      rows.push([
        `${engineId}/${scenarioName}`,
        formatCell(m.coldExtractionMs, 'ms'),
        formatCell(m.warmExtractionMs, 'ms'),
        formatCell(m.wholeProjectScanMs, 'ms'),
        formatCell(m.peakTransientMb, 'MB'),
        formatCell(m.retainedGrowthMb, 'MB'),
        m.retainedSlopeMbPerSave.status === 'measured'
          ? `${m.retainedSlopeMbPerSave.value.toFixed(2)}MB/save`
          : 'n/a',
      ]);
    }
  }

  const widths = HEADER.map((_, col) => Math.max(...rows.map((row) => (row[col] ?? '').length)));
  const table = rows.map(
    (row) => `  ${row.map((cell, col) => (cell ?? '').padEnd(widths[col])).join('  ')}`
  );
  return { table, statusLines };
}

/**
 * Ratio lines, each carrying its own caveat.
 *
 * A ratio between engines that documented different numbers of members is not a speed comparison -
 * the faster side was fast because it resolved less. Printing such a ratio bare reads as a clean
 * win, so the member counts and the warning travel with it, on the warm line as much as the cold
 * one. The warm line needs it more: on these projects the legacy Vue parser has documented zero
 * members on the save it was timed on.
 */
export function renderRatios(ratios: Ratios): string[] {
  const lines: string[] = [];

  for (const [pairName, scenarios] of Object.entries(ratios)) {
    for (const [scenarioName, entry] of Object.entries(scenarios)) {
      const notLikeForLike = entry.likeForLike === false;
      const label = `${pairName}/${scenarioName}`;

      if (entry.cold !== undefined) {
        lines.push(
          `  ratio cold legacy/new (${label}): ${entry.cold.toFixed(2)}` +
            memberNote(entry.legacyColdMembers, entry.nextColdMembers, notLikeForLike)
        );
      }
      if (entry.warm !== undefined) {
        lines.push(
          `  ratio warm legacy/new (${label}): ${entry.warm.toFixed(2)}` +
            memberNote(entry.legacyWarmMembers, entry.nextWarmMembers, notLikeForLike)
        );
      }
    }
  }

  if (lines.length === 0) {
    lines.push('  no calibration ratio: it needs both sides of a control pair measured in one run');
  }
  return lines;
}

function memberNote(
  legacy: number | undefined,
  next: number | undefined,
  notLikeForLike: boolean
): string {
  if (legacy === undefined || next === undefined) {
    return notLikeForLike ? '  [NOT like-for-like]' : '';
  }
  return `  [documented members ${legacy} vs ${next}${notLikeForLike ? ' - NOT like-for-like' : ''}]`;
}
