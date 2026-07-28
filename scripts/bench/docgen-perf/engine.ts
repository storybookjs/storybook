/**
 * What the orchestrator knows about an engine. Engines differ only in how one repetition is
 * produced; everything downstream (aggregation, member counts) follows from that choice.
 */
import * as path from 'node:path';

import type { SeriesResult } from '../docgen-shared/series.ts';
import { seriesMetrics } from './aggregate.ts';
import type { SuiteProfile } from './config.ts';
import type { SeriesChildSpec } from './spawn.ts';
import type { EngineId, EngineMetrics } from './types.ts';

export interface ScenarioSpec {
  name: string;
  /** Recorded verbatim in the results so a stored run is self-describing. */
  params: Record<string, number | string | boolean>;
}

export interface MeasureContext {
  /** Scratch directory for this engine/scenario: generated project and per-repetition JSON. */
  scenarioDir: string;
  rssPollIntervalMs: number;
  runSeriesChild(spec: SeriesChildSpec, outDir: string, jsonPath: string): SeriesResult;
}

/** `Sample` is whatever one repetition of this engine produces. */
export abstract class BenchEngine<Sample = unknown> {
  abstract readonly id: EngineId;

  /** Engines outside the default run only measure when named with `--engine`. */
  inDefaultRun = true;

  abstract scenarios(profile: SuiteProfile): ScenarioSpec[];

  abstract measure(ctx: MeasureContext, scenario: ScenarioSpec, rep: number): Promise<Sample>;

  abstract aggregate(samples: Sample[], expectedN: number): EngineMetrics;

  /**
   * Anything that must resolve before the run starts. A returned string is the skip reason: a
   * missing external tool is a partial install, not a regression, so it is reported as skipped
   * rather than failed.
   */
  preflight(): string | undefined {
    return undefined;
  }

  /** The resolved version of an externally installed engine, recorded with the results. */
  version(): string | undefined {
    return undefined;
  }

  /** Members the cold pass documented. Undefined when the engine cannot report a count. */
  coldMembers(_sample: Sample): number | undefined {
    return undefined;
  }

  /** Members the timed re-extraction documented. */
  warmMembers(_sample: Sample): number | undefined {
    return undefined;
  }

  /**
   * Of the cold pass's members, how many the engine documented under a type name it never resolved.
   * Two engines can agree on {@link coldMembers} and still have done entirely different work, so a
   * member count alone does not establish like-for-like; this is what separates them.
   */
  coldOpaqueTypes(_sample: Sample): number | undefined {
    return undefined;
  }
}

export interface SeriesChildConfig {
  id: EngineId;
  /** Child entry point, relative to this directory. */
  child: string;
  scenarios(profile: SuiteProfile): ScenarioSpec[];
  args(scenario: ScenarioSpec): string[];
  /** Only the reused docgen-memory harness runs under the jiti loader. */
  jiti?: boolean;
  inDefaultRun?: boolean;
}

/**
 * An engine measured by spawning a series-harness child, one fresh process per repetition. All
 * engines of this kind share the series harness, so aggregation and member counts are the same
 * for each.
 */
export class SeriesChildEngine extends BenchEngine<SeriesResult> {
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

  async measure(ctx: MeasureContext, scenario: ScenarioSpec, rep: number): Promise<SeriesResult> {
    return ctx.runSeriesChild(
      {
        childPath: path.join(import.meta.dirname, this.#config.child),
        args: this.#config.args(scenario),
        jiti: this.#config.jiti,
      },
      path.join(ctx.scenarioDir, 'project'),
      path.join(ctx.scenarioDir, `rep${rep}.json`)
    );
  }

  aggregate(samples: SeriesResult[], expectedN: number): EngineMetrics {
    return seriesMetrics(samples, expectedN);
  }

  coldMembers(sample: SeriesResult): number | undefined {
    return sample.coldMembers;
  }

  warmMembers(sample: SeriesResult): number | undefined {
    return sample.warmMembers;
  }
}
