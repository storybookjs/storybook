// Exercises scripts/judge-ds-misuse.ts as a process, the way the pipeline
// test drives compare-results.ts. Every planted run carries a fresh cached
// judgement, so the pass reuses them all and spends nothing — the API key is
// stripped from the environment anyway, as a second lock on the same door.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { copyTaskFixture, measuredResultJson } from '../../comparison/test-fixtures.ts';
import { DS_MISUSE_JUDGE_VERSION, JUDGE_MODEL } from './context.ts';
import { dsDocsRefLabel } from './ds-docs.ts';

const AGENT_EVAL_ROOT = fileURLToPath(new URL('../../../..', import.meta.url));
const EXPERIMENT = 'agentic-ref-cc-control-none-opus-high';
const WF = '703-fix-bug-flow';
const TS = '2026-08-05T00-00-00.000Z';

const root = mkdtempSync(join(tmpdir(), 'judge-cli-'));
const resultsDir = join(root, 'results');

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

/** A collected run whose cached judgement is fresh by every isStale check. */
function plantJudgedRun(run: number): void {
  const dir = join(resultsDir, EXPERIMENT, TS, WF, `run-${run}`);
  mkdirSync(dir, { recursive: true });
  copyTaskFixture(WF, join(dir, 'project'));
  writeFileSync(
    join(dir, 'result.json'),
    JSON.stringify(measuredResultJson(EXPERIMENT, WF)) + '\n'
  );
  writeFileSync(
    join(dir, 'ds-misuse.json'),
    JSON.stringify({
      metricsVersion: 8,
      judgeVersion: DS_MISUSE_JUDGE_VERSION,
      judgedAt: 'fixture',
      model: JUDGE_MODEL,
      dsGuidelinesRef: dsDocsRefLabel(),
      fixtureRef: 'fixture@ref',
      diffTruncated: false,
      summary: {
        correctDsDecision: null,
        correctDsUsage: null,
        correctLocalDecision: null,
        evaluated: { ds: 0, local: 0 },
      },
      nodes: [],
    }) + '\n'
  );
}

describe('judge:ds-misuse CLI', () => {
  it('deducts cached judgements from the headline count', () => {
    plantJudgedRun(1);
    plantJudgedRun(2);
    const env: NodeJS.ProcessEnv = { ...process.env, AGENT_EVAL_RESULTS_DIR: resultsDir };
    delete env.ANTHROPIC_API_KEY;
    const output = execFileSync(
      process.execPath,
      [
        join(AGENT_EVAL_ROOT, 'scripts', 'judge-ds-misuse.ts'),
        `--experiments=${EXPERIMENT}`,
        '--evals=703',
      ],
      { env, stdio: 'pipe' }
    ).toString();
    expect(output).toContain('Judging up to 0 run(s) (2 cached judgement(s) reused free)');
    expect(output).toContain('0 judged, 2 reused');
  }, 120_000);
});
