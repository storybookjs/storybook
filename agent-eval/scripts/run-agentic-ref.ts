#!/usr/bin/env node
// The agentic-reference runner: one entrypoint for the 70x case matrix.
//
//   yarn workspace agent-eval run eval:agentic-ref [flags]
//
//   --experiments <list>  cases to run, by name or glob (default: every case)
//   --evals <list>        evals to run, by name, number (703) or glob (70*)
//                         (default: each case's own eval set)
//   --runs <n>            repetitions per (experiment, eval) cell
//   --force               re-run cells that already have saved results
//   --dry                 resolve the selection and print the plan, spending nothing
//   --expect <n>          spend guard: refuse to run unless the plan is exactly n evals
//   --smoke               one eval per experiment, for checking setup
//   --ack-failures        keep infra/timeout failures as final results
//
// --cases and --flows are accepted as aliases for --experiments and --evals;
// singular spellings work too. Lists take commas, repeats, or both. Every flag
// falls back to AGENTIC_REF_<FLAG>, so CI can pass a selection through env
// without a second grammar — see lib/agentic-reference/selection.ts.
//
// Selection resolves against the ACTIVE registry (AGENTIC_REF_EVAL_REGISTRY in
// cases.ts), not the evals/ directory: a fixture can sit on disk while parked
// out of the registry, and a token matching nothing fails here rather than
// running the wrong thing.
import { spawn, spawnSync } from 'node:child_process';

import { AGENTIC_REF_EVAL_REGISTRY } from '../lib/agentic-reference/cases.ts';
import {
  parsePlannedEvalCount,
  resolveEvalSelection,
  selectionFlags,
} from '../lib/agentic-reference/selection.ts';
import { generateAgenticRefWorkdir } from './generate-agentic-ref-experiments.ts';
import { AGENT_EVAL_BIN, GENERATED_EVALS_WORK_DIR } from '#lib/agentic-reference/constants';

function fail(message: string): never {
  console.error(`eval:agentic-ref: ${message}`);
  process.exit(1);
}

function main(): void {
  const flags = selectionFlags(process.env);
  const argv = flags
    .parser(
      process.argv.slice(2),
      {
        scriptName: 'eval:agentic-ref',
        usage: 'Usage: yarn workspace agent-eval run eval:agentic-ref [flags]',
      },
      {
        experiments: flags.experiments,
        evals: flags.evals,
        runs: flags.count('runs', 'Repetitions per (experiment, eval) cell'),
        expect: flags.count('expect', 'Refuse to run unless the plan is exactly this many evals'),
        force: flags.switch('force', 'Re-run cells that already have saved results'),
        dry: flags.switch('dry', 'Print the plan and spend nothing'),
        smoke: flags.switch('smoke', 'One eval per experiment, for checking setup'),
        ackFailures: flags.switch('ackFailures', 'Keep infra/timeout failures as final results'),
      }
    )
    .parseSync();

  const experiments = argv.experiments;
  const evals = resolveEvalSelection(argv.evals, AGENTIC_REF_EVAL_REGISTRY);
  const { runs, expect, force, dry, smoke, ackFailures } = argv;

  generateAgenticRefWorkdir();

  // The child reads its selection from env because the case registry is
  // evaluated inside the CLI's own process, when it loads each experiment stub.
  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    EVAL_AGENTIC_REFERENCE: '1',
    // Explicit names only by this point, so a stub that loads outside this
    // runner still gets a selection it can validate.
    AGENTIC_REF_EVALS: evals.join(','),
    ...(runs === undefined ? {} : { AGENTIC_REF_RUNS: String(runs) }),
  };

  const cliArgs = [
    'run-all',
    ...experiments,
    ...(force ? ['--force'] : []),
    ...(smoke ? ['--smoke'] : []),
    ...(ackFailures ? ['--ack-failures'] : []),
  ];

  console.log(
    `Selection: ${experiments.length === 0 ? 'every experiment' : experiments.join(', ')}` +
      ` × ${evals.length === 0 ? "each experiment's own evals" : evals.join(', ')}` +
      `${runs === undefined ? '' : ` × ${runs} run(s)`}`
  );

  // A dry run is free, so it doubles as the spend guard's measurement: --expect
  // checks the plan it just printed instead of resolving the selection twice.
  if (dry || expect !== undefined) {
    const planned = printPlan(cliArgs, childEnv);
    if (expect !== undefined) {
      enforcePlanSize(expect, planned);
    }
    if (dry) {
      return;
    }
  }

  const child = spawn(AGENT_EVAL_BIN, cliArgs, {
    cwd: GENERATED_EVALS_WORK_DIR,
    env: childEnv,
    stdio: 'inherit',
  });
  child.on('exit', (code, signal) => {
    process.exit(signal !== null ? 1 : (code ?? 1));
  });
}

/** Runs the selection as a dry run, echoes the plan, and returns its eval count. */
function printPlan(cliArgs: string[], childEnv: NodeJS.ProcessEnv): number | null {
  const plan = spawnSync(AGENT_EVAL_BIN, [...cliArgs, '--dry'], {
    cwd: GENERATED_EVALS_WORK_DIR,
    env: childEnv,
    encoding: 'utf8',
  });
  const output = `${plan.stdout ?? ''}${plan.stderr ?? ''}`;
  process.stdout.write(output);

  if (plan.status !== 0) {
    fail('the dry run failed, so nothing could be planned. Nothing was run.');
  }
  return parsePlannedEvalCount(output);
}

/**
 * Refuses to spend unless the plan is exactly the size the dispatcher expected.
 *
 * The count comes from the plan rather than from the selection, so the guard
 * measures what will actually run — fingerprint-cached cells included.
 */
function enforcePlanSize(expected: number, planned: number | null): void {
  if (planned === null) {
    fail('could not read the eval count from the dry-run plan. Nothing was run.');
  }
  if (planned !== expected) {
    fail(
      `the selection resolves to ${planned} evals, but --expect is ${expected}. Nothing was run.`
    );
  }
  console.log(`Plan matches: ${planned} evals.`);
}

try {
  main();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
