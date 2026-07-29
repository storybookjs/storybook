/**
 * Orchestrator for the per-engine docgen performance suite. See scripts/bench/PERF-METHODOLOGY.md
 * for the measurement contract.
 *
 * Run:
 *   yarn bench:docgen-perf                # from scripts/, full profile
 *   yarn bench:docgen-perf --quick        # smoke profile; results marked non-comparable
 *   yarn bench:docgen-perf --engine react-legacy --engine react-osa
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { SANDBOX_DIRECTORY } from '../docgen-shared/paths.ts';
import { designatedRep } from './aggregate.ts';
import { parseCliOptions } from './cli.ts';
import { DEFAULT_PROFILE, QUICK_PROFILE, type SuiteProfile } from './config.ts';
import type { ScenarioSpec } from './engine.ts';
import { computeRatios, engineOrderForRep } from './ratios.ts';
import { engineById } from './registry.ts';
import { renderRatios, renderResults } from './report.ts';
import { runSeriesChild } from './spawn.ts';
import type { EngineId, EngineResult, ScenarioResult, SuiteResults } from './types.ts';

const WORK_ROOT = path.join(SANDBOX_DIRECTORY, 'docgen-perf');

/** Raw repetition samples, keyed by `engine/scenario`. */
type SampleStore = Map<string, unknown[]>;

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

function assembleScenario(
  engineId: EngineId,
  scenario: ScenarioSpec,
  profile: SuiteProfile,
  store: SampleStore
): ScenarioResult {
  const engine = engineById(engineId);
  const samples = store.get(scenarioKey(engineId, scenario.name)) ?? [];
  const metrics = engine.aggregate(samples, profile.n);
  // Member counts come from the same repetition as the warm and memory metrics, so every figure
  // reported for a scenario describes one run.
  const designated = designatedRep(samples as Array<{ coldMs: number }>);
  return {
    params: scenario.params,
    metrics,
    coldMembers: engine.coldMembers(designated),
    warmMembers: engine.warmMembers(designated),
    coldOpaqueTypes: engine.coldOpaqueTypes(designated),
  };
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2), WORK_ROOT);
  const profile: SuiteProfile = options.quick ? QUICK_PROFILE : DEFAULT_PROFILE;

  console.log('docgen-perf suite');
  console.log(`  engines=${options.engines.join(',')} n=${profile.n} comparable=${profile.comparable}`);
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
        scenarios[scenario.name] = assembleScenario(engineId, scenario, profile, store);
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
    ratios: computeRatios(engineResults),
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
    process.exit(1);
  }
  console.log('\ndocgen-perf suite completed.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
