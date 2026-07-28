/**
 * What the orchestrator knows about an engine.
 *
 * Engines differ in exactly one way: how one repetition is produced. Five of them spawn a
 * series-harness child and get a save series back; Compodoc runs an external CLI and gets one
 * triple back. Everything downstream - which aggregation applies, whether there are member counts
 * to report - follows from that choice, so it is the only thing a subclass decides.
 *
 * React and Vue are not separate kinds. They are the same {@link SeriesChildEngine} with a different
 * child file and different flags, which is data, not behaviour.
 */
import * as path from 'node:path';

import type { EngineId } from '../docgen-shared/engine-ids.ts';
import type { SeriesResult } from '../docgen-shared/series.ts';
import { seriesMetrics } from './aggregate.ts';
import type { SuiteProfile } from './config.ts';
import type { SeriesChildSpec } from './spawn.ts';
import type { EngineMetrics } from './types.ts';

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
   * Anything that must resolve before the run starts. A returned string is the skip reason, and a
   * skip is reported instead of a failure: a missing external tool is what a partial install looks
   * like, not a regression.
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
 * An engine measured by spawning a series-harness child, one fresh process per repetition. The
 * child produces the save series; aggregation and member counts are the same for every engine of
 * this kind because they all share the series harness.
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
