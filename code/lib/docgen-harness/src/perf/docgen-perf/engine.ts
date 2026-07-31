/** Engine registry contract for one fresh-process latency repetition. */
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';

import type { LatencyRepetition } from '../docgen-shared/latency-series.ts';
import type { SuiteProfile } from './config.ts';
import type { LatencyChildSpec } from './spawn.ts';
import { assertCompleteLatencyRepetitions, summarizeLatencyRepetitions } from './summary.ts';
import type { EngineId, ScenarioResult } from './types.ts';

const require = createRequire(import.meta.url);

function resolvePackageVersion(packageName: string): string | undefined {
  try {
    const packagePath = require.resolve(`${packageName}/package.json`);
    return (JSON.parse(fs.readFileSync(packagePath, 'utf8')) as { version: string }).version;
  } catch {
    return undefined;
  }
}

export interface ScenarioSpec {
  name: string;
  /** Recorded verbatim so a stored run is self-describing. */
  params: Record<string, number | string | boolean>;
}

export interface MeasureContext {
  scenarioDir: string;
  runLatencyChild(spec: LatencyChildSpec, outDir: string, jsonPath: string): LatencyRepetition;
}

export abstract class BenchEngine {
  abstract readonly id: EngineId;

  /** Engines outside the default run only measure when named with `--engine`. */
  inDefaultRun = true;

  abstract scenarios(profile: SuiteProfile): ScenarioSpec[];

  abstract measure(
    ctx: MeasureContext,
    scenario: ScenarioSpec,
    repetition: number
  ): Promise<LatencyRepetition>;

  preflight(): string | undefined {
    return undefined;
  }

  version(): string | undefined {
    return undefined;
  }

  assemble(
    repetitions: LatencyRepetition[],
    expectedRepetitions: number,
    scenario: ScenarioSpec
  ): ScenarioResult {
    const expectedWarmObservations =
      typeof scenario.params.saves === 'number' ? scenario.params.saves : undefined;
    assertCompleteLatencyRepetitions(repetitions, expectedRepetitions, expectedWarmObservations);
    return {
      params: scenario.params,
      repetitions,
      summary: summarizeLatencyRepetitions(repetitions),
    };
  }
}

export interface SeriesChildConfig {
  id: EngineId;
  /** Child entry point, relative to this directory. */
  child: string;
  scenarios(profile: SuiteProfile): ScenarioSpec[];
  args(scenario: ScenarioSpec): string[];
  /** The React OSA source child still requires the jiti loader. */
  jiti?: boolean;
  inDefaultRun?: boolean;
  versionPackage?: string;
}

export class SeriesChildEngine extends BenchEngine {
  readonly id: EngineId;
  readonly #config: SeriesChildConfig;

  constructor(config: SeriesChildConfig) {
    super();
    this.id = config.id;
    this.inDefaultRun = config.inDefaultRun ?? true;
    this.#config = config;
  }

  scenarios(profile: SuiteProfile): ScenarioSpec[] {
    return this.#config.scenarios(profile);
  }

  preflight(): string | undefined {
    const { versionPackage } = this.#config;
    if (versionPackage && resolvePackageVersion(versionPackage) === undefined) {
      return `${versionPackage} did not resolve; it is pinned in code/lib/docgen-harness/package.json, so run yarn install`;
    }
    return undefined;
  }

  version(): string | undefined {
    return this.#config.versionPackage
      ? resolvePackageVersion(this.#config.versionPackage)
      : undefined;
  }

  async measure(
    ctx: MeasureContext,
    scenario: ScenarioSpec,
    repetition: number
  ): Promise<LatencyRepetition> {
    return ctx.runLatencyChild(
      {
        childPath: path.join(import.meta.dirname, this.#config.child),
        args: this.#config.args(scenario),
        expectedWorkload: { ...scenario.params },
        jiti: this.#config.jiti,
      },
      path.join(ctx.scenarioDir, 'project'),
      path.join(ctx.scenarioDir, `rep${repetition}.json`)
    );
  }
}
