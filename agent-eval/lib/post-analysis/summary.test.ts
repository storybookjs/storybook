import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { mergeIntoEvalSummary } from './summary.ts';

const HARNESS_SUMMARY = { totalRuns: 2, passedRuns: 1, passRate: '50%', meanDuration: 431.55 };
const ROWS = [{ experiment: 'x', eval: 'e', runs: 2, costUsd: { total: 4.2, reported: 2 } }];

let evalDir: string;

function summaryPath() {
  return join(evalDir, 'summary.json');
}

function readSummary() {
  return JSON.parse(readFileSync(summaryPath(), 'utf8'));
}

beforeEach(() => {
  evalDir = mkdtempSync(join(tmpdir(), 'eval-summary-'));
});

afterEach(() => {
  rmSync(evalDir, { recursive: true, force: true });
});

describe('mergeIntoEvalSummary', () => {
  it('adds the rows without disturbing the harness fields', () => {
    writeFileSync(summaryPath(), JSON.stringify(HARNESS_SUMMARY));

    mergeIntoEvalSummary(evalDir, ROWS);

    expect(readSummary()).toEqual({ ...HARNESS_SUMMARY, postAnalysis: ROWS });
  });

  it('replaces its own key rather than accumulating across invocations', () => {
    writeFileSync(summaryPath(), JSON.stringify(HARNESS_SUMMARY));

    mergeIntoEvalSummary(evalDir, [{ runs: 1 }]);
    mergeIntoEvalSummary(evalDir, ROWS);

    expect(readSummary().postAnalysis).toEqual(ROWS);
  });

  // Losing the analysis because the harness never wrote a summary would be the
  // worse trade, so an absent file is written fresh.
  it('writes a fresh file when the harness produced none', () => {
    mergeIntoEvalSummary(evalDir, ROWS);

    expect(readSummary()).toEqual({ postAnalysis: ROWS });
  });

  it('does not trust a truncated summary', () => {
    writeFileSync(summaryPath(), '{"totalRuns": 2, "passRa');

    mergeIntoEvalSummary(evalDir, ROWS);

    expect(readSummary()).toEqual({ postAnalysis: ROWS });
  });

  it('creates the file where the run-* directories live', () => {
    mkdirSync(join(evalDir, 'run-1'), { recursive: true });
    mkdirSync(join(evalDir, 'run-2'), { recursive: true });

    mergeIntoEvalSummary(evalDir, ROWS);

    expect(readSummary().postAnalysis).toEqual(ROWS);
    expect(readFileSync(summaryPath(), 'utf8').endsWith('\n')).toBe(true);
  });
});
