/**
 * CI regression gate for the docgen-server memory behavior
 * (https://github.com/storybookjs/storybook/issues/35260).
 *
 * Runs {@link file://./memory-harness.ts} in fresh child processes (so each measurement starts from a
 * clean heap) and asserts two independent things:
 *
 *   1. Steady-state churn/leak-freeness (`changed-scope` metric config): post-GC `heapUsed` must not
 *      climb across saves, and the per-save transient working set must stay under budget. A regression
 *      that re-extracts the whole index would blow past these.
 *   2. The OOM fix itself, as a **crash → survive negative control** (`live` configs): the live path
 *      (many per-component `batchExtract` calls on the shared program) is run under a tight heap cap
 *      both WITH and WITHOUT program recycling.
 *        - recycle OFF (`--recycle off`, ratio Infinity) MUST OOM — proving the cap, not luck, makes
 *          the workload crash without the fix.
 *        - recycle ON (default) MUST survive — proving the fix prevents that crash.
 *      Asserting the flip (not just survival) is what makes this guard the fix rather than the cap.
 *
 * Run:
 *   yarn bench:docgen-memory          # from scripts/
 *   node --import jiti/register scripts/bench/docgen-memory/gate.ts
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { SANDBOX_DIRECTORY } from '../../utils/constants.ts';

interface HarnessResult {
  baseline: { rssMb: number; heapUsedMb: number; retainedHeapMb?: number };
  peakRss: number;
  retainedSlope?: number;
  retainedGrowth?: number;
  avgTransient?: number;
}

interface MetricBudgets {
  /** Max allowed post-GC retained growth (MB) across the run. */
  maxRetainedGrowthMb: number;
  /** Max allowed average transient working set added per save (MB). */
  maxTransientMb: number;
  /** Max allowed post-GC retained-heap slope (MB/save). */
  maxRetainedSlopeMb: number;
}

interface GateConfig {
  name: string;
  args: string[];
  /** Subdirectory under the gate output dir for this config's generated project + result.json. */
  outSubdir: string;
  /** `--max-old-space-size` cap (MB) for the child. Omit to run uncapped. */
  capMb?: number;
  /**
   * Crash → survive negative control. `true` ⇒ the child MUST OOM (recycle disabled); `false` ⇒ it
   * MUST survive (recycle on). Omit for metric-only configs.
   */
  expectOom?: boolean;
  /** Post-GC metric budgets, asserted from `result.json` (metric configs only). */
  budgets?: MetricBudgets;
}

const HARNESS = path.join(import.meta.dirname, 'memory-harness.ts');

/** V8 heap-limit OOM signature, used to confirm the negative control crashed for the right reason. */
const OOM_SIGNATURE = /heap out of memory|Reached heap limit|Allocation failed/i;

const CONFIGS: GateConfig[] = [
  {
    // The fixed steady state we protect: each save re-extracts only the changed component. Budgets sit
    // well above observed values (transient ~8–30MB, retained flat) so the gate is not flaky, while
    // still failing hard if a regression reintroduces whole-index re-extraction (hundreds of MB/save).
    name: 'changed-scope steady state (N=600, props=10, 20 saves)',
    args: [
      '--components', '600',
      '--variants', '4',
      '--props', '10',
      '--saves', '20',
      '--mode', 'refresh',
      '--scope', 'changed',
    ],
    outSubdir: 'changed-scope',
    budgets: { maxRetainedGrowthMb: 60, maxTransientMb: 90, maxRetainedSlopeMb: 3 },
  },
  {
    // Positive control: the live per-edit workload survives under a tight cap BECAUSE the shared
    // program is recycled under heap pressure. Pair with the negative control below.
    name: 'live path survives WITH recycling (N=800, --heavy, cap 1536MB)',
    args: [
      '--components', '800',
      '--variants', '4',
      '--props', '10',
      '--saves', '1',
      '--mode', 'live',
      '--recycle', 'on',
      '--heavy',
      '--no-force-gc',
    ],
    outSubdir: 'live',
    capMb: 1536,
    expectOom: false,
  },
  {
    // Negative control: the SAME workload + cap, with recycling disabled, MUST OOM. If this ever
    // survives, the cap is too loose (or the workload shrank) and the positive control above proves
    // nothing — fail so the pair is re-tuned.
    name: 'live path OOMs WITHOUT recycling — negative control (N=800, --heavy, cap 1536MB)',
    args: [
      '--components', '800',
      '--variants', '4',
      '--props', '10',
      '--saves', '1',
      '--mode', 'live',
      '--recycle', 'off',
      '--heavy',
      '--no-force-gc',
    ],
    outSubdir: 'live',
    capMb: 1536,
    expectOom: true,
  },
];

/**
 * Generate into the same place sandboxes go (`../storybook-sandboxes` by default, overridable via
 * `STORYBOOK_SANDBOX_ROOT`) and leave it on disk, so a human can open the generated project and see
 * exactly what the gate exercised.
 */
const GATE_PROJECT_DIR = path.join(SANDBOX_DIRECTORY, 'docgen-memory-gate');

interface RunOutcome {
  status: number | null;
  output: string;
  result?: HarnessResult;
}

function runHarness(config: GateConfig): RunOutcome {
  const outDir = path.join(GATE_PROJECT_DIR, config.outSubdir);
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'result.json');
  // Remove any stale result so a crashed run cannot be mistaken for a prior success.
  fs.rmSync(jsonPath, { force: true });

  const nodeArgs = [
    '--expose-gc',
    ...(config.capMb ? [`--max-old-space-size=${config.capMb}`] : []),
    '--import',
    'jiti/register',
    HARNESS,
    ...config.args,
    '--out',
    outDir,
    '--json',
    jsonPath,
  ];

  const proc = spawnSync(process.execPath, nodeArgs, { encoding: 'utf8' });
  const output = `${proc.stdout ?? ''}${proc.stderr ?? ''}`;
  // Echo a compact tail so CI logs show what happened without the full V8 crash dump.
  console.log(
    output
      .trim()
      .split('\n')
      .slice(-8)
      .map((line) => `    ${line}`)
      .join('\n')
  );

  const result = fs.existsSync(jsonPath)
    ? (JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as HarnessResult)
    : undefined;
  return { status: proc.status, output, result };
}

function checkMetricConfig(config: GateConfig, outcome: RunOutcome, failures: string[]): void {
  if (outcome.status !== 0) {
    failures.push(`${config.name}: harness exited with status ${outcome.status}`);
    console.log(`  ✗ harness crashed unexpectedly (status ${outcome.status})`);
    return;
  }
  if (!outcome.result || !config.budgets) {
    failures.push(`${config.name}: missing result.json (run with --json)`);
    console.log('  ✗ result.json missing');
    return;
  }

  const { budgets, name } = config;
  const checks: Array<{ label: string; value: number | undefined; budget: number }> = [
    { label: 'retained growth (MB)', value: outcome.result.retainedGrowth, budget: budgets.maxRetainedGrowthMb },
    { label: 'avg transient/save (MB)', value: outcome.result.avgTransient, budget: budgets.maxTransientMb },
    { label: 'retained slope (MB/save)', value: outcome.result.retainedSlope, budget: budgets.maxRetainedSlopeMb },
  ];

  for (const { label, value, budget } of checks) {
    if (value === undefined) {
      failures.push(`${name}: missing metric "${label}" (run with --expose-gc)`);
      console.log(`  ✗ ${label}: <missing>`);
      continue;
    }
    const ok = value <= budget;
    console.log(`  ${ok ? '✓' : '✗'} ${label}: ${value.toFixed(1)} (budget ${budget})`);
    if (!ok) {
      failures.push(`${name}: ${label} ${value.toFixed(1)} exceeds budget ${budget}`);
    }
  }
}

function checkNegativeControl(config: GateConfig, outcome: RunOutcome, failures: string[]): void {
  const crashed = outcome.status !== 0;
  const hasOomSignature = OOM_SIGNATURE.test(outcome.output);

  if (config.expectOom) {
    // Must crash AND for the right reason (a heap-limit OOM, not some other failure).
    if (crashed && hasOomSignature) {
      console.log('  ✓ OOMed as expected without recycling (negative control holds)');
      return;
    }
    if (!crashed) {
      failures.push(
        `${config.name}: expected an OOM without recycling, but the run survived — the cap is too ` +
          `loose or the workload shrank; re-tune the live config pair.`
      );
      console.log('  ✗ expected OOM, but survived');
    } else {
      failures.push(`${config.name}: crashed (status ${outcome.status}) but without a heap-OOM signature`);
      console.log(`  ✗ crashed (status ${outcome.status}) but not a heap OOM`);
    }
    return;
  }

  // expectOom === false: must survive.
  if (outcome.status === 0) {
    console.log('  ✓ survived with recycling enabled');
    return;
  }
  const why = hasOomSignature ? 'OOM' : `status ${outcome.status}`;
  failures.push(`${config.name}: expected survival with recycling, but the run failed (${why})`);
  console.log(`  ✗ expected survival, but failed (${why})`);
}

function main() {
  const failures: string[] = [];

  for (const config of CONFIGS) {
    console.log(`\n=== ${config.name} ===`);
    const outcome = runHarness(config);
    if (config.expectOom !== undefined) {
      checkNegativeControl(config, outcome, failures);
    } else {
      checkMetricConfig(config, outcome, failures);
    }
  }

  console.log('');
  if (failures.length > 0) {
    console.error('docgen memory gate FAILED:');
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exit(1);
  }
  console.log('docgen memory gate passed.');
}

main();
