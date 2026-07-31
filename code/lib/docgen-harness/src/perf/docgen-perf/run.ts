/** Descriptive docgen latency suite and opt-in paired timing gate. */
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import type { LatencyRepetition } from '../docgen-shared/latency-series.ts';
import { SANDBOX_DIRECTORY } from '../docgen-shared/paths.ts';
import { parseCliOptions } from './cli.ts';
import {
  COMPARISON_PAIRS,
  assessMetricWork,
  comparePairedTimings,
  createComparisonPlan,
  evaluateBudget,
  executeComparisonPlan,
  type WorkProfile,
} from './comparison.ts';
import { DEFAULT_PROFILE, QUICK_PROFILE, type SuiteProfile } from './config.ts';
import type { ScenarioSpec } from './engine.ts';
import { engineById } from './registry.ts';
import { renderComparisons, renderResults } from './report.ts';
import { runLatencyChild } from './spawn.ts';
import { warmTrajectoryMedian } from './summary.ts';
import type {
  ComparisonResult,
  EngineId,
  EngineResult,
  RawPairedBlock,
  ScenarioResult,
  SuiteResults,
} from './types.ts';

const WORK_ROOT = path.join(SANDBOX_DIRECTORY, 'docgen-perf');
type SampleStore = Map<string, LatencyRepetition[]>;

function scenarioKey(engineId: EngineId, scenarioName: string): string {
  return `${engineId}/${scenarioName}`;
}

async function measureScenario(
  engineId: EngineId,
  scenario: ScenarioSpec,
  repetition: number,
  total: number,
  store: SampleStore
): Promise<LatencyRepetition> {
  const key = scenarioKey(engineId, scenario.name);
  console.log(`  ${key} (rep ${repetition}/${total})…`);
  const sample = await engineById(engineId).measure(
    {
      scenarioDir: path.join(WORK_ROOT, engineId, scenario.name),
      runLatencyChild,
    },
    scenario,
    repetition
  );
  store.set(key, [...(store.get(key) ?? []), sample]);
  return sample;
}

function signatureOf(repetition: LatencyRepetition): Omit<WorkProfile, 'version'> {
  return {
    cold: {
      members: repetition.cold.members,
      opaqueTypes: repetition.cold.opaqueTypes,
    },
    warm: repetition.warm.map(({ save, members, opaqueTypes }) => ({
      save,
      members,
      opaqueTypes,
    })),
  };
}

/** A profile is known only when the scripted work stayed identical across every fresh process. */
function workProfile(repetitions: LatencyRepetition[], version?: string): WorkProfile {
  const signatures = repetitions.map(signatureOf);
  const first = signatures[0];
  if (!first) {
    return { version };
  }
  const cold = JSON.stringify(first.cold);
  const warm = JSON.stringify(first.warm);
  return {
    version,
    ...(signatures.every((signature) => JSON.stringify(signature.cold) === cold)
      ? { cold: first.cold }
      : {}),
    ...(signatures.every((signature) => JSON.stringify(signature.warm) === warm)
      ? { warm: first.warm }
      : {}),
  };
}

async function runDescriptive(
  engines: EngineId[],
  profile: SuiteProfile,
  store: SampleStore,
  failed: Map<EngineId, string>,
  skipped: Map<EngineId, string>
): Promise<void> {
  for (let repetition = 1; repetition <= profile.repetitions; repetition++) {
    console.log(`\n=== repetition ${repetition}/${profile.repetitions} ===`);
    for (const engineId of engines) {
      if (failed.has(engineId) || skipped.has(engineId)) {
        continue;
      }
      try {
        for (const scenario of engineById(engineId).scenarios(profile)) {
          await measureScenario(engineId, scenario, repetition, profile.repetitions, store);
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        failed.set(engineId, reason);
        console.error(`  ${engineId} FAILED: ${reason}`);
      }
    }
  }
}

async function runPaired(
  pairName: string,
  globalSeed: number,
  profile: SuiteProfile,
  store: SampleStore,
  blocksByScenario: Map<string, RawPairedBlock[]>,
  failed: Map<EngineId, string>,
  skipped: Map<EngineId, string>
): Promise<void> {
  const pair = COMPARISON_PAIRS.find(({ name }) => name === pairName)!;
  const controlSkip = skipped.get(pair.control);
  const candidateSkip = skipped.get(pair.candidate);
  if (controlSkip || candidateSkip) {
    if (!controlSkip) {
      skipped.set(
        pair.control,
        `comparison partner ${pair.candidate} was skipped: ${candidateSkip}`
      );
    }
    if (!candidateSkip) {
      skipped.set(pair.candidate, `comparison partner ${pair.control} was skipped: ${controlSkip}`);
    }
    return;
  }
  const controlScenarios = engineById(pair.control).scenarios(profile);
  const candidateScenarios = engineById(pair.candidate).scenarios(profile);
  const controlScenarioNames = controlScenarios.map(({ name }) => name).sort();
  const candidateScenarioNames = candidateScenarios.map(({ name }) => name).sort();
  if (JSON.stringify(controlScenarioNames) !== JSON.stringify(candidateScenarioNames)) {
    throw new Error(
      `${pair.name} has mismatched scenario sets: ` +
        `${pair.control}=${controlScenarioNames.join(',')} ` +
        `${pair.candidate}=${candidateScenarioNames.join(',')}`
    );
  }

  for (const controlScenario of controlScenarios) {
    const candidateScenario = candidateScenarios.find(({ name }) => name === controlScenario.name);
    if (!candidateScenario) {
      throw new Error(`${pair.candidate} has no scenario named ${controlScenario.name}`);
    }
    if (JSON.stringify(candidateScenario.params) !== JSON.stringify(controlScenario.params)) {
      throw new Error(`${pair.name}/${controlScenario.name} has mismatched scenario parameters`);
    }

    const plan = createComparisonPlan({
      seed: globalSeed,
      pair: pair.name,
      scenario: controlScenario.name,
      repetitions: profile.repetitions,
    });
    console.log(`\n=== paired ${pair.name}/${controlScenario.name} seed=${plan.seed} ===`);
    try {
      const blocks = await executeComparisonPlan(plan, async (side, block) => {
        const engineId = side === 'control' ? pair.control : pair.candidate;
        const scenario = side === 'control' ? controlScenario : candidateScenario;
        try {
          return await measureScenario(engineId, scenario, block, profile.repetitions, store);
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          failed.set(engineId, reason);
          console.error(`  ${engineId} FAILED: ${reason}`);
          throw error;
        }
      });
      blocksByScenario.set(controlScenario.name, blocks);
    } catch {
      return;
    }
  }
}

function assembleEngineResults(
  engines: EngineId[],
  profile: SuiteProfile,
  store: SampleStore,
  failed: Map<EngineId, string>,
  skipped: Map<EngineId, string>
): {
  engineResults: SuiteResults['engines'];
  engineVersions: SuiteResults['engineVersions'];
} {
  const engineResults: SuiteResults['engines'] = {};
  const engineVersions: SuiteResults['engineVersions'] = {};

  for (const engineId of engines) {
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
    const failReason = failed.get(engineId);
    if (failReason) {
      engineResults[engineId] = { status: 'failed', reason: failReason };
      continue;
    }
    try {
      const scenarios: Record<string, ScenarioResult> = {};
      for (const scenario of engine.scenarios(profile)) {
        scenarios[scenario.name] = engine.assemble(
          store.get(scenarioKey(engineId, scenario.name)) ?? [],
          profile.repetitions,
          scenario
        );
      }
      engineResults[engineId] = { status: 'measured', scenarios } satisfies EngineResult;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failed.set(engineId, reason);
      engineResults[engineId] = { status: 'failed', reason };
    }
  }
  return { engineResults, engineVersions };
}

function descriptiveComparisons(
  engineResults: SuiteResults['engines'],
  engineVersions: SuiteResults['engineVersions']
): SuiteResults['comparisons'] {
  const comparisons: SuiteResults['comparisons'] = {};
  for (const pair of COMPARISON_PAIRS) {
    const control = engineResults[pair.control];
    const candidate = engineResults[pair.candidate];
    if (control?.status !== 'measured' || candidate?.status !== 'measured') {
      continue;
    }
    const scenarios: ComparisonResult['scenarios'] = {};
    for (const [name, controlScenario] of Object.entries(control.scenarios)) {
      const candidateScenario = candidate.scenarios[name];
      if (!candidateScenario) {
        continue;
      }
      const controlWork = workProfile(controlScenario.repetitions, engineVersions[pair.control]);
      const candidateWork = workProfile(
        candidateScenario.repetitions,
        engineVersions[pair.candidate]
      );
      const workOptions = {
        versionsMustDiffer: 'versionsMustDiffer' in pair && pair.versionsMustDiffer,
      };
      scenarios[name] = {
        blocks: [],
        cold: {
          work: assessMetricWork(controlWork, candidateWork, 'cold', workOptions),
          gate: { status: 'not-configured' },
        },
        warm: {
          work: assessMetricWork(controlWork, candidateWork, 'warm', workOptions),
          gate: { status: 'not-configured' },
        },
      };
    }
    comparisons[pair.name] = {
      mode: 'descriptive',
      control: pair.control,
      candidate: pair.candidate,
      controlVersion: engineVersions[pair.control],
      candidateVersion: engineVersions[pair.candidate],
      scenarios,
    };
  }
  return comparisons;
}

function pairedComparison(
  pairName: string,
  engineResults: SuiteResults['engines'],
  profile: SuiteProfile,
  blocksByScenario: Map<string, RawPairedBlock[]>,
  engineVersions: SuiteResults['engineVersions'],
  globalSeed: number,
  maxRegression: number,
  smoke: boolean
): SuiteResults['comparisons'] {
  const pair = COMPARISON_PAIRS.find(({ name }) => name === pairName)!;
  if (
    engineResults[pair.control]?.status !== 'measured' ||
    engineResults[pair.candidate]?.status !== 'measured'
  ) {
    return {};
  }
  const scenarios: ComparisonResult['scenarios'] = {};

  for (const [scenarioName, blocks] of blocksByScenario) {
    const controlRepetitions = blocks.map(({ control }) => control);
    const candidateRepetitions = blocks.map(({ candidate }) => candidate);
    const comparisonInput = {
      controlWork: workProfile(controlRepetitions, engineVersions[pair.control]),
      candidateWork: workProfile(candidateRepetitions, engineVersions[pair.candidate]),
      expectedPairs: profile.repetitions,
      versionsMustDiffer: 'versionsMustDiffer' in pair && pair.versionsMustDiffer,
    };
    const cold = comparePairedTimings({
      ...comparisonInput,
      metric: 'cold',
      timings: blocks.map(({ block, control, candidate }) => ({
        block,
        controlMs: control.cold.durationMs,
        candidateMs: candidate.cold.durationMs,
      })),
    });
    const warm = comparePairedTimings({
      ...comparisonInput,
      metric: 'warm',
      timings: blocks.map(({ block, control, candidate }) => ({
        block,
        controlMs: warmTrajectoryMedian(control),
        candidateMs: warmTrajectoryMedian(candidate),
      })),
    });
    const budgetOptions = { repetitions: profile.repetitions, maxRegression, smoke };
    scenarios[scenarioName] = {
      seed: createComparisonPlan({
        seed: globalSeed,
        pair: pair.name,
        scenario: scenarioName,
        repetitions: profile.repetitions,
      }).seed,
      blocks,
      cold: {
        work: cold.work,
        effect: cold.effect,
        gate: evaluateBudget(cold, budgetOptions),
      },
      warm: {
        work: warm.work,
        effect: warm.effect,
        gate: evaluateBudget(warm, budgetOptions),
      },
    };
  }
  return {
    [pair.name]: {
      mode: 'paired-gate',
      control: pair.control,
      candidate: pair.candidate,
      controlVersion: engineVersions[pair.control],
      candidateVersion: engineVersions[pair.candidate],
      scenarios,
    },
  };
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2), WORK_ROOT);
  const baseProfile = options.quick ? QUICK_PROFILE : DEFAULT_PROFILE;
  const profile = {
    ...baseProfile,
    repetitions: options.repetitions ?? baseProfile.repetitions,
  };
  const seed = options.compare ? (options.seed ?? randomBytes(4).readUInt32LE()) : undefined;

  console.log('docgen-perf suite');
  console.log(
    `  engines=${options.engines.join(',')} repetitions=${profile.repetitions} ` +
      `mode=${options.compare ? 'paired-gate' : 'descriptive'}`
  );
  if (options.quick) {
    console.log('  QUICK PROFILE: smoke workload, never a timing gate');
  }
  if (seed !== undefined) {
    console.log(`  seed=${seed}`);
  }

  const store: SampleStore = new Map();
  const failed = new Map<EngineId, string>();
  const skipped = new Map<EngineId, string>();
  const blocksByScenario = new Map<string, RawPairedBlock[]>();

  for (const engineId of options.engines) {
    const reason = engineById(engineId).preflight();
    if (reason) {
      skipped.set(engineId, reason);
      console.log(`  ${engineId}: SKIPPED - ${reason}`);
    }
  }

  try {
    if (options.compare) {
      await runPaired(options.compare, seed!, profile, store, blocksByScenario, failed, skipped);
    } else {
      await runDescriptive(options.engines, profile, store, failed, skipped);
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    for (const engineId of options.engines) {
      if (!skipped.has(engineId)) {
        failed.set(engineId, reason);
      }
    }
  }

  const { engineResults, engineVersions } = assembleEngineResults(
    options.engines,
    profile,
    store,
    failed,
    skipped
  );
  const comparisons = options.compare
    ? pairedComparison(
        options.compare,
        engineResults,
        profile,
        blocksByScenario,
        engineVersions,
        seed!,
        options.maxRegression!,
        options.quick
      )
    : descriptiveComparisons(engineResults, engineVersions);
  const results: SuiteResults = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    nodeVersion: process.version,
    profile: options.quick ? 'quick' : 'full',
    repetitions: profile.repetitions,
    mode: options.compare ? 'paired-gate' : 'descriptive',
    gating: options.compare !== undefined && !options.quick,
    ...(options.compare ? { comparisonMethod: 'paired-log-ratio-t95-v1' as const, seed } : {}),
    engineVersions,
    engines: engineResults,
    comparisons,
  };

  console.log('\nresults');
  const { table, statusLines } = renderResults(options.engines, engineResults);
  for (const line of [...table, ...statusLines, ...renderComparisons(comparisons)]) {
    console.log(line);
  }
  fs.mkdirSync(path.dirname(options.jsonOut), { recursive: true });
  fs.writeFileSync(options.jsonOut, JSON.stringify(results, null, 2));
  console.log(`  wrote ${options.jsonOut}`);

  const gateFailed = Object.values(comparisons).some((comparison) =>
    Object.values(comparison.scenarios).some((scenario) =>
      [scenario.cold.gate.status, scenario.warm.gate.status].some(
        (status) => status === 'regression' || status === 'invalid-gate'
      )
    )
  );
  if (failed.size > 0 || gateFailed) {
    if (failed.size > 0) {
      console.error('\ndocgen-perf suite FAILED:');
      for (const [engineId, reason] of failed) {
        console.error(`  - ${engineId}: ${reason}`);
      }
    }
    process.exitCode = 1;
    return;
  }
  console.log('\ndocgen-perf suite completed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
