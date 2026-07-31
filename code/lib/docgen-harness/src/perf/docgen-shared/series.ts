/**
 * The memory save-series harness:
 * one timed cold pass, then K simulated saves that mutate the project on disk, invalidate the
 * engine's caches, and re-extract, with memory sampled around forced GC after every save. Engines
 * differ only in what those steps mean, so they implement {@link SeriesEngine} and this module owns
 * the timing.
 */
import type { MemorySample, SaveSample } from './samples.ts';
import { formatSampleLine, sampleMemory } from './sampling.ts';
import { type SeriesSummary, summarizeSeries } from './stats.ts';

export interface SeriesEngine {
  /**
   * One full extraction over the measured set, from a cold start. Returns how many members it
   * documented, when the engine can report that; two engines over one project can differ by an order
   * of magnitude, and a timing comparison between them means nothing without it.
   */
  cold(): number | undefined | Promise<number | undefined>;
  /** Mutate the project on disk for save `save` and invalidate the engine's caches. Never timed. */
  applySave(save: number): void | Promise<void>;
  /** Re-extract after save `save`. This call, and only this call, is the warm sample. */
  reextract(save: number): number | undefined | Promise<number | undefined>;
  dispose?(): void;
}

export interface SeriesResult extends SeriesSummary {
  coldMs: number;
  coldMembers?: number;
  /** Members documented by the last timed re-extraction. */
  warmMembers?: number;
  baseline: MemorySample;
  samples: SaveSample[];
}

export interface SeriesOptions {
  saves: number;
  /** Describes the measured set for the cold-pass log line, e.g. "300 components". */
  coldLabel: string;
  /** Off only for the memory harness's uncapped pressure configs, which measure pre-GC rss. */
  forceGc?: boolean;
}

export async function runSeries(
  engine: SeriesEngine,
  options: SeriesOptions
): Promise<SeriesResult> {
  const forceGc = options.forceGc ?? true;

  console.log(`  full extraction over ${options.coldLabel} (cold pass)…`);
  const coldStart = performance.now();
  const coldMembers = await engine.cold();
  const coldMs = performance.now() - coldStart;
  console.log(
    `  cold pass: ${coldMs.toFixed(0)}ms` +
      (coldMembers !== undefined ? ` (${coldMembers} documented members)` : '')
  );

  const baseline = sampleMemory(forceGc);
  const samples: SaveSample[] = [];
  let warmMembers: number | undefined;

  for (let save = 1; save <= options.saves; save++) {
    await engine.applySave(save);

    // performance.now(), not Date.now(): a warm re-extraction of a single component runs in single
    // -digit milliseconds, and at Date.now()'s 1ms granularity a whole series can median to 0 - a
    // number any comparison against it would then divide by.
    const saveStart = performance.now();
    warmMembers = await engine.reextract(save);
    const durMs = performance.now() - saveStart;

    const mem = sampleMemory(forceGc);
    samples.push({ save, durMs, documentedMembers: warmMembers, ...mem });
    console.log(formatSampleLine(save, durMs, mem));
  }

  engine.dispose?.();

  return {
    coldMs,
    coldMembers,
    warmMembers,
    baseline,
    samples,
    ...summarizeSeries(samples, baseline),
  };
}

export function printSeriesSummary(result: SeriesResult, saves: number): void {
  console.log('\nsummary');
  console.log(`  cold pass:           ${result.coldMs.toFixed(0)}ms`);
  if (result.coldMembers !== undefined) {
    // `n/a` rather than 0: an engine that reports no count did not document nothing.
    const warm = result.warmMembers ?? 'n/a';
    console.log(`  documented members:  ${result.coldMembers} cold, ${warm} on the last save`);
  }
  if (result.avgTransient !== undefined) {
    console.log(`  avg transient/save:  ${result.avgTransient.toFixed(0)}MB`);
  }
  if (result.retainedSlope !== undefined && result.retainedGrowth !== undefined) {
    console.log(`  retained slope:      ${result.retainedSlope.toFixed(2)}MB/save`);
    console.log(`  retained growth:     ${result.retainedGrowth.toFixed(0)}MB over ${saves} saves`);
  }
}

/** Entry-point wrapper: any throw becomes a non-zero exit, which is how the orchestrator sees it. */
export function harnessMain(run: () => Promise<void>): void {
  run().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
