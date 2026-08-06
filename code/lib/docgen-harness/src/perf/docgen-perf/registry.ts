/**
 * The engine table. Adding an engine means adding one entry here; the orchestrator has no
 * per-engine branches. Everything below is data: which child to spawn, with which flags, over
 * which scenarios.
 */
import type { SuiteProfile } from './config.ts';
import { type BenchEngine, type ScenarioSpec, SeriesChildEngine } from './engine.ts';
import { CompodocEngine } from './engines/compodoc.ts';
import type { EngineId } from './types.ts';

const reactScenarios = (profile: SuiteProfile): ScenarioSpec[] =>
  profile.react.map((scenario) => ({ name: scenario.shape, params: { ...scenario } }));

const vueScenarios = (profile: SuiteProfile): ScenarioSpec[] =>
  profile.vue.map((scenario) => ({ name: scenario.name, params: { ...scenario } }));

const reactArgs = ({ params }: ScenarioSpec): string[] => [
  '--shape',
  String(params.shape),
  '--components',
  String(params.components),
  '--variants',
  String(params.variants),
  '--props',
  String(params.props),
  '--saves',
  String(params.saves),
];

const vueArgs = ({ params }: ScenarioSpec): string[] => [
  '--scenario',
  String(params.name),
  '--packages',
  String(params.packages),
  '--components-per-package',
  String(params.componentsPerPackage),
  '--chain-depth',
  String(params.chainDepth),
  '--fan-out',
  String(params.fanOut),
  ...(params.heavyLib ? ['--heavy-lib'] : []),
  '--saves',
  String(params.saves),
];

export const ENGINES: BenchEngine[] = [
  // --scope changed on both sides of the React pair compares the engines on equal work; that is
  // not what a real legacy save costs - see the calibration caveat in PERF-METHODOLOGY.md.
  new SeriesChildEngine({
    id: 'react-legacy',
    child: 'engines/react-legacy.ts',
    scenarios: reactScenarios,
    args: (scenario) => [...reactArgs(scenario), '--parser', 'react-docgen', '--scope', 'changed'],
  }),
  // Measurable through the same child, but it carries no budget row, so it stays out by default.
  new SeriesChildEngine({
    id: 'react-legacy-rdt',
    child: 'engines/react-legacy.ts',
    scenarios: reactScenarios,
    inDefaultRun: false,
    args: (scenario) => [
      ...reactArgs(scenario),
      '--parser',
      'react-docgen-typescript',
      '--scope',
      'changed',
    ],
  }),
  new SeriesChildEngine({
    id: 'react-osa',
    child: '../docgen-memory/memory-harness.ts',
    scenarios: reactScenarios,
    jiti: true,
    args: (scenario) => [...reactArgs(scenario), '--mode', 'refresh', '--scope', 'changed'],
  }),
  new SeriesChildEngine({
    id: 'vue-docgen-api',
    child: 'engines/vue-docgen-api.ts',
    scenarios: vueScenarios,
    args: vueArgs,
  }),
  new SeriesChildEngine({
    id: 'vue-component-meta',
    child: 'engines/vue-component-meta.ts',
    scenarios: vueScenarios,
    args: vueArgs,
    pin: 'vue-component-meta',
  }),
  // Same child, pinned to a second, explicitly-versioned copy of the package - a version-pair
  // control rather than an engine-vs-engine one. No budget row yet, so it stays out of the
  // default run; a contributor testing a bump runs both ids with --engine explicitly.
  new SeriesChildEngine({
    id: 'vue-component-meta-next',
    child: 'engines/vue-component-meta.ts',
    scenarios: vueScenarios,
    inDefaultRun: false,
    args: vueArgs,
    pin: 'vue-component-meta-next',
  }),
  new CompodocEngine(),
  // Always fails. The gate names it explicitly to prove the gate reports a failing engine as a
  // failure; nothing else ever runs it.
  new SeriesChildEngine({
    id: 'crash-control',
    child: 'engines/crash-control.ts',
    scenarios: () => [{ name: 'default', params: {} }],
    inDefaultRun: false,
    args: () => [],
  }),
];

export const ALL_ENGINE_IDS: EngineId[] = ENGINES.map((engine) => engine.id);
export const DEFAULT_ENGINE_IDS: EngineId[] = ENGINES.filter((e) => e.inDefaultRun).map(
  (e) => e.id
);

export function engineById(id: EngineId): BenchEngine {
  const engine = ENGINES.find((candidate) => candidate.id === id);
  if (!engine) {
    throw new Error(`no engine registered for "${id}"`);
  }
  return engine;
}
