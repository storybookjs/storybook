/** Pure terminal rendering for Storybook-owned latency results. */
import type { EngineId, EngineResult, SuiteResults } from './types.ts';

const HEADER = ['engine/scenario', 'cold', 'warm trajectory', 'scan', 'processes'];

export interface RenderedResults {
  table: string[];
  statusLines: string[];
}

function gateText(
  metric: SuiteResults['comparisons'][string]['scenarios'][string]['cold']
): string {
  const parts = [`gate=${metric.gate.status}`];
  if (metric.gate.maxCandidateOverControl !== undefined) {
    parts.push(`limit=${metric.gate.maxCandidateOverControl.toFixed(3)}`);
  }
  if (metric.gate.reason) {
    parts.push(`reason=${metric.gate.reason}`);
  }
  return parts.join(' ');
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
      rows.push([
        `${engineId}/${scenarioName}`,
        `${scenario.summary.cold.medianMs.toFixed(1)}ms`,
        `${scenario.summary.warm.medianMs.toFixed(1)}ms`,
        scenario.summary.scan ? `${scenario.summary.scan.medianMs.toFixed(1)}ms` : 'n/a',
        String(scenario.repetitions.length),
      ]);
    }
  }

  const widths = HEADER.map((_, column) => Math.max(...rows.map((row) => row[column].length)));
  return {
    table: rows.map((row) =>
      `  ${row.map((cell, column) => cell.padEnd(widths[column])).join('  ')}`.trimEnd()
    ),
    statusLines,
  };
}

function effectLine(
  pairName: string,
  scenarioName: string,
  metricName: 'cold' | 'warm',
  metric: SuiteResults['comparisons'][string]['scenarios'][string]['cold'],
  versions: string
): string {
  const label = `${pairName}/${scenarioName}`;
  const work = `${metric.work.status}(${metric.work.reason})${versions}`;
  const gate = gateText(metric);
  if (!metric.effect) {
    return `  ${label} ${metricName}: work=${work} ${gate}`;
  }
  if (metric.effect.status === 'invalid') {
    return (
      `  ${label} ${metricName}: invalid effect (${metric.effect.reason}) ` + `work=${work} ${gate}`
    );
  }
  const ratio = metric.effect.candidateOverControl;
  return (
    `  ${label} ${metricName}: candidate/control=${ratio.estimate.toFixed(3)} ` +
    `95%=[${ratio.lower95.toFixed(3)},${ratio.upper95.toFixed(3)}] ` +
    `pairs=${metric.effect.pairs} work=${work} ${gate}`
  );
}

export function renderComparisons(comparisons: SuiteResults['comparisons']): string[] {
  const lines: string[] = [];
  for (const [pairName, comparison] of Object.entries(comparisons)) {
    const versions =
      comparison.controlVersion && comparison.candidateVersion
        ? ` versions=${comparison.controlVersion}/${comparison.candidateVersion}`
        : '';
    for (const [scenarioName, scenario] of Object.entries(comparison.scenarios)) {
      lines.push(effectLine(pairName, scenarioName, 'cold', scenario.cold, versions));
      lines.push(effectLine(pairName, scenarioName, 'warm', scenario.warm, versions));
    }
  }
  if (lines.length === 0) {
    lines.push('  no comparison: both sides of a configured pair must measure');
  }
  return lines;
}
