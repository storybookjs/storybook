/**
 * What the orchestrator knows about an engine. Engines differ only in how one repetition is
 * produced; everything downstream (aggregation, member counts) follows from that choice.
 */
import * as path from 'node:path';

import { resolvePin } from '../docgen-shared/pin.ts';
import type { SeriesResult } from '../docgen-shared/series.ts';
import { designatedRep, seriesMetrics } from './aggregate.ts';
import type { SuiteProfile } from './config.ts';
import type { SeriesChildSpec } from './spawn.ts';
import type { EngineId, EngineMetrics, MemberCounts, ScenarioResult } from './types.ts';

export interface ScenarioSpec {
  name: string;
  /** Recorded verbatim in the results so a stored run is self-describing. */
  params: Record<string, number | string | boolean>;
}

/** Only what every engine needs. What one engine alone cares about stays inside that engine. */
export interface MeasureContext {
  /** Scratch directory for this engine/scenario: generated project and per-repetition JSON. */
  scenarioDir: string;
  runSeriesChild(spec: SeriesChildSpec, outDir: string, jsonPath: string): SeriesResult;
}

/**
 * `Sample` is whatever one repetition of this engine produces. Every engine's sample carries the
 * cold-pass duration, because that is what picks the one repetition every single-run figure is read
 * from.
 */
export abstract class BenchEngine<Sample extends { coldMs: number } = { coldMs: number }> {
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

  /**
   * What one repetition documented. An engine that cannot report a count leaves it out, which is
   * what keeps a missing count from being read as a measured zero. The counts an engine does report
   * are what establishes whether a ratio against it compared equal work.
   */
  members(_sample: Sample): MemberCounts {
    return {};
  }

  /**
   * One scenario's complete result. `Sample` is still bound here, so the orchestrator never has to
   * name - or cast to - the sample shape a particular engine happens to produce.
   */
  assemble(samples: Sample[], expectedN: number, scenario: ScenarioSpec): ScenarioResult {
    // aggregate() first: it is what rejects a run that never reached the pinned N, and there is
    // nothing for designatedRep to pick from until that has passed.
    const metrics = this.aggregate(samples, expectedN);
    // The counts are read from the same repetition as the warm and memory metrics, so every figure
    // reported for a scenario describes one run.
    return { params: scenario.params, metrics, ...this.members(designatedRep(samples)) };
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
  /**
   * The install this engine measures: the canonical package name, or the alias of a second,
   * explicitly-versioned copy of it. Passed to the child as `--pin` and reported as the engine's
   * version, so a version pair is two entries differing only in this field. Only for children that
   * accept `--pin`; see docgen-shared/pin.ts.
   */
  pin?: string;
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

  /**
   * A declared `pin` is what the child imports, so failing to resolve it means a partial install.
   * Skipping here rather than letting `version()` quietly answer undefined is what keeps a version
   * pair from running with no way to tell its two installs apart - the one failure that comparison
   * exists to catch.
   */
  preflight(): string | undefined {
    const { pin } = this.#config;
    if (pin && !resolvePin(pin)) {
      return `${pin} did not resolve; it is pinned in code/lib/docgen-harness/package.json, so run yarn install`;
    }
    return undefined;
  }

  version(): string | undefined {
    return this.#config.pin ? resolvePin(this.#config.pin)?.version : undefined;
  }

  async measure(ctx: MeasureContext, scenario: ScenarioSpec, rep: number): Promise<SeriesResult> {
    const { args, child, jiti, pin } = this.#config;
    return ctx.runSeriesChild(
      {
        childPath: path.join(import.meta.dirname, child),
        // The pin reaches the child as a flag, so no engine spells it out in its own `args`.
        args: pin ? [...args(scenario), '--pin', pin] : args(scenario),
        jiti,
      },
      path.join(ctx.scenarioDir, 'project'),
      path.join(ctx.scenarioDir, `rep${rep}.json`)
    );
  }

  aggregate(samples: SeriesResult[], expectedN: number): EngineMetrics {
    return seriesMetrics(samples, expectedN);
  }

  members(sample: SeriesResult): MemberCounts {
    return { coldMembers: sample.coldMembers, warmMembers: sample.warmMembers };
  }
}
