import pc from 'picocolors';

import type { CheckResult, Verdict } from './types.ts';

const LABELS: Record<CheckResult['id'], string> = {
  human: 'Human-monitored',
  'real-problem': 'Real problem',
  duplicate: 'Not duplicate',
  'cost-benefit': 'Cost/benefit',
  'explains-test': 'Explains how to test',
  'provides-context': 'Provides context',
};

const STATUS_COLOR: Record<CheckResult['status'], (s: string) => string> = {
  pass: pc.green,
  fail: pc.red,
  warn: pc.yellow,
  deferred: pc.dim,
};

export interface SummaryInput {
  pr: { number: number; title: string; author: string; url: string };
  verdict: Verdict;
  results: CheckResult[];
  reviewBody: string;
  labelsToAdd: string[];
  labelsToRemove: string[];
  dryRun: boolean;
}

const CHECK_ORDER: CheckResult['id'][] = [
  'human',
  'real-problem',
  'duplicate',
  'cost-benefit',
  'explains-test',
  'provides-context',
];

export function renderSummary(input: SummaryInput): string {
  const { pr, verdict, results, reviewBody, labelsToAdd, labelsToRemove, dryRun } = input;
  const verdictText = verdict === 'pass' ? pc.green('PASS') : pc.red('FAIL');
  const lines: string[] = [];
  lines.push(`${pc.bold(`MVC Assessment — #${pr.number} "${pr.title}"`)}`);
  lines.push(`Author: @${pr.author}  |  Verdict: ${verdictText}`);
  lines.push('');
  lines.push('| Criterion              | Status   | Evidence                                              |');
  lines.push('|------------------------|----------|-------------------------------------------------------|');
  const byId = new Map(results.map((r) => [r.id, r] as const));
  for (const id of CHECK_ORDER) {
    const result = byId.get(id);
    if (!result) continue;
    const label = LABELS[id].padEnd(22);
    const status = STATUS_COLOR[result.status](result.status.toUpperCase().padEnd(8));
    const evidence = truncate(result.evidence, 53).padEnd(53);
    lines.push(`| ${label} | ${status} | ${evidence} |`);
  }
  lines.push('');
  lines.push(dryRun ? pc.cyan('[dry-run] Review:') : pc.cyan('Review submitted:'));
  lines.push('─────────────────────────────────────');
  lines.push(reviewBody);
  lines.push('─────────────────────────────────────');
  lines.push('');
  lines.push(dryRun ? pc.cyan('[dry-run] Labels:') : pc.cyan('Labels applied:'));
  for (const l of labelsToRemove) lines.push(`  remove: ${l}`);
  for (const l of labelsToAdd) lines.push(`  add:    ${l}`);
  return lines.join('\n');
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}
