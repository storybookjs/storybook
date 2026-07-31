import { Bench, type TaskResult } from 'tinybench';

export interface ResettableLatencyTask {
  name: string;
  beforeEach(): void;
  measure(): void;
  afterEach(): void;
}

export interface LatencySummary {
  sampleCount: number;
  sortedSamplesMs: number[];
  meanMs: number;
  medianMs: number;
  minMs: number;
  maxMs: number;
  medianAbsoluteDeviationMs: number;
  standardDeviationMs: number;
  marginOfErrorMs: number;
  relativeMarginOfErrorPercent: number;
  confidenceLevel: 0.95;
}

export interface ResettableEngine {
  cold(): number;
  applySave(save: number): void;
  reextract(): number;
  dispose?(): void;
}

export interface WorkSignature {
  coldMembers: number;
  warmMembers: number;
}

export interface FreshTaskState {
  engine?: ResettableEngine;
  pendingColdMembers?: number;
  pendingWarmMembers?: number;
  work?: WorkSignature;
  createdEngines: number;
}

function assertSameWork(expected: WorkSignature, actual: WorkSignature, label: string): void {
  if (expected.coldMembers !== actual.coldMembers || expected.warmMembers !== actual.warmMembers) {
    throw new Error(
      `${label} work mismatch: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`
    );
  }
}

export function createFreshEngineTask(
  name: string,
  createEngine: () => ResettableEngine,
  sharedWork: { value?: WorkSignature }
): { task: ResettableLatencyTask; state: FreshTaskState } {
  const state: FreshTaskState = { createdEngines: 0 };
  let iterationFailed = false;
  let measurementCompleted = false;
  return {
    state,
    task: {
      name,
      beforeEach() {
        iterationFailed = false;
        measurementCompleted = false;
        state.engine = undefined;
        state.pendingColdMembers = undefined;
        state.pendingWarmMembers = undefined;
        try {
          state.engine = createEngine();
          state.createdEngines += 1;
          state.pendingColdMembers = state.engine.cold();
          state.engine.applySave(1);
        } catch (error) {
          iterationFailed = true;
          throw error;
        }
      },
      measure() {
        try {
          if (!state.engine) {
            throw new Error(`${name} engine was not prepared before measurement`);
          }
          state.pendingWarmMembers = state.engine.reextract();
          measurementCompleted = true;
        } catch (error) {
          iterationFailed = true;
          throw error;
        }
      },
      afterEach() {
        let validationError: unknown;
        if (!iterationFailed) {
          try {
            if (
              !measurementCompleted ||
              state.pendingColdMembers === undefined ||
              state.pendingWarmMembers === undefined
            ) {
              throw new Error(`${name} iteration did not report complete work`);
            }
            const work = {
              coldMembers: state.pendingColdMembers,
              warmMembers: state.pendingWarmMembers,
            };
            if (state.work) {
              assertSameWork(state.work, work, `${name} iteration`);
            } else {
              state.work = work;
            }
            if (sharedWork.value) {
              assertSameWork(sharedWork.value, work, `${name} task`);
            } else {
              sharedWork.value = work;
            }
          } catch (error) {
            validationError = error;
          }
        }

        const engine = state.engine;
        state.engine = undefined;
        state.pendingColdMembers = undefined;
        state.pendingWarmMembers = undefined;
        const preserveIterationError = iterationFailed;
        iterationFailed = false;
        measurementCompleted = false;

        let disposalError: unknown;
        try {
          engine?.dispose?.();
        } catch (error) {
          disposalError = error;
        }

        if (preserveIterationError) {
          return;
        }
        if (validationError) {
          throw validationError;
        }
        if (disposalError) {
          throw disposalError;
        }
      },
    },
  };
}

export function assertValidIterationCount(iterations: number): void {
  if (!Number.isInteger(iterations) || iterations < 2) {
    throw new Error(`iterations must be an integer of at least 2, received ${iterations}`);
  }
}

/** Construct without running so registration-time invocation remains directly testable. */
export function createResettableBench(tasks: ResettableLatencyTask[], iterations: number): Bench {
  assertValidIterationCount(iterations);

  const bench = new Bench({
    concurrency: null,
    iterations,
    retainSamples: true,
    throws: true,
    time: 0,
    warmup: false,
  });
  for (const task of tasks) {
    bench.add(task.name, task.measure, {
      // Tinybench otherwise calls a synchronous function during registration to detect promises.
      async: false,
      beforeEach: task.beforeEach,
      afterEach: task.afterEach,
    });
  }
  return bench;
}

export function mapTaskResult(result: TaskResult, expectedIterations: number): LatencySummary {
  assertValidIterationCount(expectedIterations);
  if (result.state !== 'completed') {
    throw new Error(`Tinybench task did not complete (state: ${result.state})`);
  }
  const { latency } = result;
  if (latency.samplesCount !== expectedIterations) {
    throw new Error(
      `Tinybench recorded ${latency.samplesCount} samples, expected exactly ${expectedIterations}`
    );
  }
  if (!latency.samples || latency.samples.length !== expectedIterations) {
    throw new Error('Tinybench did not retain the complete sample set');
  }

  const sortedSamplesMs = [...latency.samples];
  for (const [index, sample] of sortedSamplesMs.entries()) {
    assertFinitePositive(sample, `latency.samples[${index}]`);
  }
  for (const [field, value] of [
    ['latency.mean', latency.mean],
    ['latency.p50', latency.p50],
    ['latency.min', latency.min],
    ['latency.max', latency.max],
  ] as const) {
    assertFinitePositive(value, field);
  }
  for (const [field, value] of [
    ['latency.mad', latency.mad],
    ['latency.sd', latency.sd],
    ['latency.moe', latency.moe],
    ['latency.rme', latency.rme],
  ] as const) {
    assertFiniteNonNegative(value, field);
  }

  return {
    sampleCount: latency.samplesCount,
    sortedSamplesMs,
    meanMs: latency.mean,
    medianMs: latency.p50,
    minMs: latency.min,
    maxMs: latency.max,
    medianAbsoluteDeviationMs: latency.mad,
    standardDeviationMs: latency.sd,
    marginOfErrorMs: latency.moe,
    relativeMarginOfErrorPercent: latency.rme,
    confidenceLevel: 0.95,
  };
}

function assertFinitePositive(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Tinybench ${field} must be finite and greater than zero, received ${value}`);
  }
}

function assertFiniteNonNegative(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Tinybench ${field} must be finite and non-negative, received ${value}`);
  }
}
