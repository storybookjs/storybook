/**
 * Orchestrator for the per-engine docgen performance suite. See ../PERF-METHODOLOGY.md for the
 * measurement contract.
 *
 * Run from code/lib/docgen-harness:
 *   yarn bench:docgen-perf                # full profile
 *   yarn bench:docgen-perf --quick        # smoke profile; results marked non-comparable
 *   yarn bench:docgen-perf --engine react-legacy --engine react-osa
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { SANDBOX_DIRECTORY } from '../docgen-shared/paths.ts';
import { parseCliOptions } from './cli.ts';
import { DEFAULT_PROFILE, QUICK_PROFILE, type SuiteProfile } from './config.ts';
import { computeRatios, engineOrderForRep } from './ratios.ts';
import { engineById } from './registry.ts';
import { renderRatios, renderResults } from './report.ts';
import { runSeriesChild } from './spawn.ts';
import type { EngineId, EngineResult, ScenarioResult, SuiteResults } from './types.ts';

const WORK_ROOT = path.join(SANDBOX_DIRECTORY, 'docgen-perf');

/**
 * Raw repetition samples, keyed by `engine/scenario`. Only the cold duration is common to every
 * engine's sample; the rest stays known to the engine that produced it, which is what reads it back.
 */
type SampleStore = Map<string, Array<{ coldMs: number }>>;

function scenarioKey(engineId: EngineId, scenarioName: string): string {
  return `${engineId}/${scenarioName}`;
}

/** One repetition of one engine, across every scenario that engine runs. */
async function measureEngine(
  engineId: EngineId,
  profile: SuiteProfile,
  rep: number,
  store: SampleStore
): Promise<void> {
  const engine = engineById(engineId);
  for (const scenario of engine.scenarios(profile)) {
    const key = scenarioKey(engineId, scenario.name);
    console.log(`  ${key} (rep ${rep}/${profile.n})…`);
    const sample = await engine.measure(
      {
        scenarioDir: path.join(WORK_ROOT, engineId, scenario.name),
        runSeriesChild,
      },
      scenario,
      rep
    );
    store.set(key, [...(store.get(key) ?? []), sample]);
  }
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2), WORK_ROOT);
  const profile: SuiteProfile = options.quick ? QUICK_PROFILE : DEFAULT_PROFILE;

  console.log('docgen-perf suite');
  console.log(
    `  engines=${options.engines.join(',')} n=${profile.n} comparable=${profile.comparable}`
  );
  if (!profile.comparable) {
    console.log('  QUICK PROFILE: results are non-comparable smoke numbers');
  }

  const store: SampleStore = new Map();
  const failed = new Map<EngineId, string>();
  const skipped = new Map<EngineId, string>();

  for (const engineId of options.engines) {
    const reason = engineById(engineId).preflight();
    if (reason) {
      skipped.set(engineId, reason);
      console.log(`  ${engineId}: SKIPPED - ${reason}`);
    }
  }

  for (let rep = 1; rep <= profile.n; rep++) {
    console.log(`\n=== repetition ${rep}/${profile.n} ===`);
    for (const engineId of engineOrderForRep(options.engines, rep)) {
      if (failed.has(engineId) || skipped.has(engineId)) {
        continue;
      }
      try {
        await measureEngine(engineId, profile, rep, store);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        failed.set(engineId, reason);
        console.error(`  ${engineId} FAILED: ${reason}`);
      }
    }
  }

  const engineResults: SuiteResults['engines'] = {};
  const engineVersions: SuiteResults['engineVersions'] = {};

  for (const engineId of options.engines) {
    const engine = engineById(engineId);
    const version = engine.version();
    if (version) {
      engineVersions[engineId] = version;
    }

    const skipReason = skipped.get(engineId);
    if (skipReason) {
      engineResults[engineId] = { status: 'skipped', reason: skipReason };
      continue;
    }
    // An engine that failed part-way holds fewer samples than the pinned N, so it stays failed
    // rather than being reported as measured at an unrecorded N.
    const failReason = failed.get(engineId);
    if (failReason) {
      engineResults[engineId] = { status: 'failed', reason: failReason };
      continue;
    }
    try {
      const scenarios: Record<string, ScenarioResult> = {};
      for (const scenario of engine.scenarios(profile)) {
        const samples = store.get(scenarioKey(engineId, scenario.name)) ?? [];
        scenarios[scenario.name] = engine.assemble(samples, profile.n, scenario);
      }
      engineResults[engineId] = { status: 'measured', scenarios } satisfies EngineResult;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      failed.set(engineId, reason);
      engineResults[engineId] = { status: 'failed', reason };
    }
  }

  const results: SuiteResults = {
    generatedAt: new Date().toISOString(),
    nodeVersion: process.version,
    pinnedN: profile.n,
    comparable: profile.comparable,
    engineVersions,
    engines: engineResults,
    ratios: computeRatios(engineResults, engineVersions),
  };

  console.log('\nresults');
  const { table, statusLines } = renderResults(options.engines, engineResults);
  for (const line of [...table, ...statusLines, ...renderRatios(results.ratios)]) {
    console.log(line);
  }
  if (!profile.comparable) {
    console.log('  QUICK PROFILE: results are non-comparable smoke numbers');
  }

  fs.mkdirSync(path.dirname(options.jsonOut), { recursive: true });
  fs.writeFileSync(options.jsonOut, JSON.stringify(results, null, 2));
  console.log(`  wrote ${options.jsonOut}`);

  if (failed.size > 0) {
    console.error('\ndocgen-perf suite FAILED:');
    for (const [engineId, reason] of failed) {
      console.error(`  - ${engineId}: ${reason}`);
    }
    // Not `process.exit`: writes to a pipe are async, so exiting here can truncate the reasons
    // printed just above - exactly the output someone is reading when the suite fails under `tee`.
    process.exitCode = 1;
    return;
  }
  console.log('\ndocgen-perf suite completed.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
