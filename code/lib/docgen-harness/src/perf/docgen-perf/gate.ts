/**
 * CI regression gate for the per-engine docgen performance suite.
 *
 * Runs the suite once at the pinned profile, asserts every recorded budget against the results it
 * wrote, and then proves its own failure detection with a negative control: a second, tiny run that
 * includes a deliberately failing engine and MUST come back non-zero.
 *
 * The measurement contract is ../PERF-METHODOLOGY.md; the budgets are
 * ../docgen-shared/budgets.ts.
 *
 * Run from code/lib/docgen-harness:
 *   yarn bench:docgen-perf-gate
 *   yarn bench:docgen-perf-gate --out <dir>   # where the results are written
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { z } from 'zod';

import { parseHarnessOptions } from '../docgen-shared/args.ts';
import { SANDBOX_DIRECTORY } from '../docgen-shared/paths.ts';
import { type Assertion, assertBudgets } from './gate-assertions.ts';
import type { SuiteResults } from './types.ts';

const SUITE = path.join(import.meta.dirname, 'run.ts');

/** CI points this inside the checkout so the results can be stored as a build artifact. */
const { outDir: GATE_DIR } = parseHarnessOptions<{ outDir: string }>(
  process.argv.slice(2),
  { out: { type: 'string' } },
  z.object({ outDir: z.string().default(path.join(SANDBOX_DIRECTORY, 'docgen-perf-gate')) }),
  (values) => ({ outDir: values.out })
);
const RESULTS_PATH = path.join(GATE_DIR, 'results.json');

interface SuiteRun {
  status: number | null;
  results?: SuiteResults;
}

function runSuite(args: string[], jsonPath: string): SuiteRun {
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  // Remove any stale results so a crashed run cannot be asserted against a previous success.
  fs.rmSync(jsonPath, { force: true });

  const proc = spawnSync(process.execPath, [SUITE, ...args, '--json', jsonPath], {
    encoding: 'utf8',
    // The suite's own table is the record of what was measured, so it belongs in the job log in
    // full rather than as a tail after the fact.
    stdio: ['ignore', 'inherit', 'inherit'],
  });

  const results = fs.existsSync(jsonPath)
    ? (JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as SuiteResults)
    : undefined;
  return { status: proc.status, results };
}

function report(assertions: Assertion[]): string[] {
  const failures: string[] = [];
  for (const { label, ok, detail } of assertions) {
    console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? `: ${detail}` : ''}`);
    if (!ok) {
      failures.push(`${label}: ${detail ?? 'failed'}`);
    }
  }
  return failures;
}

/**
 * The suite reports a failing engine by exiting non-zero, so a gate run that includes the crash
 * control and still succeeds means failures are being swallowed somewhere between the child and
 * the job's exit status.
 */
function checkNegativeControl(): string[] {
  console.log('\n=== negative control: a failing engine must fail the gate ===');
  const controlPath = path.join(GATE_DIR, 'crash-control.json');
  const { status } = runSuite(['--quick', '--engine', 'crash-control'], controlPath);

  if (status !== 0) {
    console.log(`  ✓ suite exited ${status} on a failing engine`);
    return [];
  }
  console.log('  ✗ suite exited 0 despite a deliberately failing engine');
  return [
    'negative control: the suite reported success for a failing engine, so the gate cannot be trusted to catch a real one',
  ];
}

function main(): void {
  console.log('=== docgen perf suite (pinned profile) ===');
  const { status, results } = runSuite([], RESULTS_PATH);

  const failures: string[] = [];

  if (status !== 0) {
    failures.push(`the suite exited with status ${status}; see its output above`);
  }
  if (!results) {
    failures.push(`the suite wrote no results at ${RESULTS_PATH}`);
  } else {
    console.log('\n=== budgets ===');
    failures.push(...report(assertBudgets(results)));
  }

  failures.push(...checkNegativeControl());

  console.log('');
  if (failures.length > 0) {
    console.error('docgen perf gate FAILED:');
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    // Not process.exit: writes to a pipe are async, and exiting here can truncate the very reasons
    // someone is reading when the gate fails.
    process.exitCode = 1;
    return;
  }
  console.log(`docgen perf gate passed. Results: ${RESULTS_PATH}`);
}

main();
