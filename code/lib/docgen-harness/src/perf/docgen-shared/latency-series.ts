/**
 * Latency-only execution for stateful docgen save trajectories. Memory sampling deliberately lives
 * in `series.ts`; keeping this loop separate prevents forced GC from perturbing latency samples.
 */
import { writeFileSync } from 'node:fs';

import type { SeriesEngine } from './series.ts';

export interface LatencyObservation {
  durationMs: number;
  members?: number;
  opaqueTypes?: number;
}

export interface WarmLatencyObservation extends LatencyObservation {
  /** Save number in execution order, counting from one. */
  save: number;
}

/** One fresh process's complete, ordered latency result. */
export interface LatencyRepetition {
  cold: LatencyObservation;
  warm: WarmLatencyObservation[];
  /** Whole-project one-shot engines use this; per-component engines leave it absent. */
  scan?: LatencyObservation;
}

export interface LatencySeriesOptions {
  saves: number;
  /** Describes the measured set for the cold-pass log line, e.g. "300 components". */
  coldLabel: string;
}

export async function runLatencySeries(
  engine: SeriesEngine,
  options: LatencySeriesOptions
): Promise<LatencyRepetition> {
  let failed = false;
  try {
    if (!Number.isSafeInteger(options.saves) || options.saves < 1) {
      throw new Error(
        `latency series saves must be a positive safe integer, received ${options.saves}`
      );
    }
    console.log(`  full extraction over ${options.coldLabel} (cold pass)…`);
    const coldStart = performance.now();
    const coldMembers = await engine.cold();
    const cold = { durationMs: performance.now() - coldStart, members: coldMembers };
    console.log(
      `  cold pass: ${cold.durationMs.toFixed(0)}ms` +
        (cold.members !== undefined ? ` (${cold.members} documented members)` : '')
    );

    const warm: WarmLatencyObservation[] = [];
    for (let save = 1; save <= options.saves; save++) {
      await engine.applySave(save);
      const start = performance.now();
      const members = await engine.reextract(save);
      const durationMs = performance.now() - start;
      warm.push({ save, durationMs, members });
      console.log(
        `  save ${String(save).padStart(3)}: ${durationMs.toFixed(1).padStart(7)}ms` +
          (members !== undefined ? `  members=${members}` : '')
      );
    }

    return { cold, warm };
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    try {
      engine.dispose?.();
    } catch (error) {
      if (!failed) {
        throw error;
      }
    }
  }
}

export interface LatencySeriesHarnessSpec extends LatencySeriesOptions {
  title: string;
  options: object;
  banner?: Record<string, unknown>;
  jsonOut?: string;
  setup(): SeriesEngine | Promise<SeriesEngine>;
}

export async function runLatencySeriesHarness(spec: LatencySeriesHarnessSpec): Promise<void> {
  console.log(spec.title);
  console.log(
    `  ${Object.entries(spec.banner ?? spec.options)
      .map(([key, value]) => `${key}=${String(value)}`)
      .join(' ')}`
  );

  const result = await runLatencySeries(await spec.setup(), spec);
  if (spec.jsonOut) {
    writeFileSync(spec.jsonOut, JSON.stringify({ options: spec.options, ...result }, null, 2));
    console.log(`  wrote ${spec.jsonOut}`);
  }
}
