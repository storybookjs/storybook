/** Renders the suite's terminal output. Pure string building, so it is testable without a runner. */
import type { Comparability, EngineId, EngineResult, Metric, RatioEntry, Ratios } from './types.ts';

const HEADER = ['engine/scenario', 'cold', 'warm', 'scan', 'peak', 'ret-growth', 'ret-slope'];

/**
 * Decimals per unit. A slope needs two to say anything at all, while a sub-millisecond difference
 * between two aggregates is noise.
 */
const VALUE_PRECISION = { ms: 0, MB: 1, 'MB/save': 2 } as const;

export function formatCell(metric: Metric, unit: keyof typeof VALUE_PRECISION): string {
  return metric.status === 'n/a' ? 'n/a' : `${metric.value.toFixed(VALUE_PRECISION[unit])}${unit}`;
}

export interface RenderedResults {
  /** Already padded into aligned lines. */
  table: string[];
  /** One line per engine that skipped or failed, in place of a table row. */
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
        formatCell(m.retainedSlopeMbPerSave, 'MB/save'),
      ]);
    }
  }

  const widths = HEADER.map((_, col) => Math.max(...rows.map((row) => row[col].length)));
  // trimEnd because the last column is padded like every other one, and a run's output should not
  // carry trailing spaces on every line.
  const table = rows.map((row) =>
    `  ${row.map((cell, col) => cell.padEnd(widths[col])).join('  ')}`.trimEnd()
  );
  return { table, statusLines };
}

/**
 * A ratio between engines that documented different numbers of members is not a speed comparison -
 * the faster side was fast because it resolved less. Printing such a ratio bare reads as a clean
 * win, so the member counts and the warning travel with it, on the warm line as much as the cold
 * one. The warm line needs it more: the legacy Vue parser documents zero members on the save it is
 * timed on, so a bare warm ratio would read as a clean win over identical work.
 */
export function renderRatios(ratios: Ratios): string[] {
  const lines: string[] = [];

  for (const scenarios of Object.values(ratios)) {
    for (const [scenarioName, entry] of Object.entries(scenarios)) {
      // Naming both engines: "legacy/new" only helps a reader who already knows the pair.
      const label = `${entry.legacyEngine} over ${entry.nextEngine}, ${scenarioName}`;
      const versions = versionNote(entry);

      if (entry.cold !== undefined) {
        lines.push(
          `  ratio cold (${label}): ${entry.cold.toFixed(2)}` +
            memberNote(entry.legacyColdMembers, entry.nextColdMembers, entry.coldComparability) +
            versions
        );
      }
      if (entry.warm !== undefined) {
        lines.push(
          `  ratio warm (${label}): ${entry.warm.toFixed(2)}` +
            memberNote(entry.legacyWarmMembers, entry.nextWarmMembers, entry.warmComparability) +
            versions
        );
      }
    }
  }

  if (lines.length === 0) {
    return ['  no calibration ratio: it needs both sides of a control pair measured in one run'];
  }
  // Which way the number points is not guessable from a bare decimal.
  return [
    "  each ratio divides the first engine's median by the second's, so above 1.00 means the second is faster",
    ...lines,
  ];
}

/**
 * Spelled out rather than flagged, because the direction is what a reader needs: an engine that
 * documented less is fast for the wrong reason, while one that documented more has a ratio that
 * undersells it. A bare "NOT like-for-like" leaves those two looking the same.
 */
const VERDICT: Record<Comparability, string> = {
  // No counts is not a claim of inequality, so it earns no warning - only a direction does.
  unknown: '',
  'like-for-like': '',
  'next-documents-more':
    'NOT like-for-like - new engine documented more, so this ratio undersells it',
  'next-documents-less':
    'NOT like-for-like - new engine documented less, so it is fast for the wrong reason',
  'next-resolves-more':
    'NOT like-for-like - same members, but the new engine resolved more of them',
  'next-resolves-less':
    'NOT like-for-like - same members, but the new engine left more types unresolved',
};

function memberNote(
  legacy: number | undefined,
  next: number | undefined,
  verdict: Comparability
): string {
  const note = VERDICT[verdict];
  if (legacy === undefined || next === undefined) {
    return note ? `  [${note}]` : '';
  }
  return `  [documented members ${legacy} vs ${next}${note ? ` - ${note}` : ''}]`;
}

/**
 * Two sides on the same version compare an engine against itself, which reads as a clean 1.00 and
 * means nothing. Saying so beside the ratio is what stops it being read as "no regression".
 */
function versionNote({ legacyVersion, nextVersion }: RatioEntry): string {
  if (legacyVersion === undefined || nextVersion === undefined) {
    return '';
  }
  return legacyVersion === nextVersion
    ? `  [both sides resolved ${legacyVersion} - NOT a comparison]`
    : `  [${legacyVersion} vs ${nextVersion}]`;
}
