import { describe, expect, it } from 'vitest';

import { createFreshEngineTask, createResettableBench, mapTaskResult } from './resettable-bench.ts';
import { packageVersion, parseOptions, runVueComponentMetaLatency } from './vue-component-meta.ts';

function createCompletedResult() {
  const bench = createResettableBench(
    [{ name: 'fake', beforeEach() {}, measure() {}, afterEach() {} }],
    2
  );
  bench.runSync();
  const result = bench.results[0];
  if (result.state !== 'completed') {
    throw new Error(`expected a completed test result, received ${result.state}`);
  }
  return result;
}

describe('package provenance', () => {
  it('reads metadata even when the package does not export package.json', () => {
    expect(packageVersion('tinybench')).toBe('6.1.2');
  });
});

describe('createResettableBench', () => {
  it('does not call the measured function during registration and runs exactly K iterations', () => {
    const events: string[] = [];
    let measurements = 0;
    const bench = createResettableBench(
      [
        {
          name: 'fake',
          beforeEach: () => events.push('beforeEach'),
          measure: () => {
            measurements += 1;
            events.push('measure');
          },
          afterEach: () => events.push('afterEach'),
        },
      ],
      3
    );

    expect(measurements).toBe(0);
    bench.runSync();
    expect(measurements).toBe(3);
    expect(events).toEqual([
      'beforeEach',
      'measure',
      'afterEach',
      'beforeEach',
      'measure',
      'afterEach',
      'beforeEach',
      'measure',
      'afterEach',
    ]);
  });

  it('rejects a one-sample iteration count', () => {
    expect(() => createResettableBench([], 1)).toThrow('at least 2');
  });
});

describe('latency options', () => {
  it('rejects one-sample CLI and programmatic runs', async () => {
    expect(() => parseOptions(['--iterations', '1'])).toThrow('must be at least 2');
    await expect(
      runVueComponentMetaLatency({ quick: false, iterations: 1, jsonOut: 'unused.json' })
    ).rejects.toThrow('at least 2');
  });
});

describe('createFreshEngineTask', () => {
  it('creates and primes one new engine for every exact iteration', () => {
    const events: string[] = [];
    let nextId = 0;
    const entry = createFreshEngineTask(
      'current',
      () => {
        const id = ++nextId;
        return {
          cold: () => (events.push(`cold:${id}`), 10),
          applySave: (save) => events.push(`save:${id}:${save}`),
          reextract: () => (events.push(`warm:${id}`), 2),
          dispose: () => events.push(`dispose:${id}`),
        };
      },
      {}
    );
    createResettableBench([entry.task], 3).runSync();
    expect(entry.state.createdEngines).toBe(3);
    expect(events).toEqual([
      'cold:1',
      'save:1:1',
      'warm:1',
      'dispose:1',
      'cold:2',
      'save:2:1',
      'warm:2',
      'dispose:2',
      'cold:3',
      'save:3:1',
      'warm:3',
      'dispose:3',
    ]);
  });

  it('fails when work changes between iterations or tasks', () => {
    let iteration = 0;
    let disposals = 0;
    const unstable = createFreshEngineTask(
      'current',
      () => ({
        cold: () => 10,
        applySave() {},
        reextract: () => ++iteration,
        dispose: () => {
          disposals += 1;
        },
      }),
      {}
    );
    expect(() => createResettableBench([unstable.task], 2).runSync()).toThrow('work mismatch');
    expect(disposals).toBe(2);

    const shared = { value: { coldMembers: 10, warmMembers: 2 } };
    const candidate = createFreshEngineTask(
      'next',
      () => ({ cold: () => 11, applySave() {}, reextract: () => 2 }),
      shared
    );
    expect(() => createResettableBench([candidate.task], 2).runSync()).toThrow('work mismatch');
  });

  it.each(['cold', 'applySave', 'reextract'] as const)(
    'disposes after a %s failure without replacing the original error',
    (failurePoint) => {
      const originalError = new Error(`${failurePoint} failed`);
      let disposals = 0;
      const entry = createFreshEngineTask(
        'current',
        () => ({
          cold() {
            if (failurePoint === 'cold') {
              throw originalError;
            }
            return 10;
          },
          applySave() {
            if (failurePoint === 'applySave') {
              throw originalError;
            }
          },
          reextract() {
            if (failurePoint === 'reextract') {
              throw originalError;
            }
            return 2;
          },
          dispose() {
            disposals += 1;
            throw new Error('cleanup failed');
          },
        }),
        {}
      );

      let receivedError: unknown;
      try {
        createResettableBench([entry.task], 2).runSync();
      } catch (error) {
        receivedError = error;
      }

      expect(receivedError).toBe(originalError);
      expect(disposals).toBe(1);
      expect(entry.state.engine).toBeUndefined();
    }
  );

  it('surfaces a disposal error when measurement and validation succeeded', () => {
    const cleanupError = new Error('cleanup failed');
    const entry = createFreshEngineTask(
      'current',
      () => ({
        cold: () => 10,
        applySave() {},
        reextract: () => 2,
        dispose: () => {
          throw cleanupError;
        },
      }),
      {}
    );

    let receivedError: unknown;
    try {
      createResettableBench([entry.task], 2).runSync();
    } catch (error) {
      receivedError = error;
    }
    expect(receivedError).toBe(cleanupError);
  });
});

describe('mapTaskResult', () => {
  it('maps only the Storybook-owned latency fields', () => {
    const bench = createResettableBench(
      [{ name: 'fake', beforeEach() {}, measure() {}, afterEach() {} }],
      3
    );
    bench.runSync();
    const summary = mapTaskResult(bench.results[0], 3);
    expect(summary.sampleCount).toBe(3);
    expect(summary.sortedSamplesMs).toHaveLength(3);
    expect(summary.confidenceLevel).toBe(0.95);
    expect(summary).not.toHaveProperty('throughput');
  });

  it('rejects incomplete or non-completed results', () => {
    const bench = createResettableBench(
      [{ name: 'fake', beforeEach() {}, measure() {}, afterEach() {} }],
      2
    );
    expect(() => mapTaskResult(bench.results[0], 2)).toThrow('did not complete');
    bench.runSync();
    expect(() => mapTaskResult(bench.results[0], 3)).toThrow('expected exactly 3');
  });

  it('rejects non-finite and non-positive sample durations', () => {
    const nonFinite = createCompletedResult();
    nonFinite.latency.samples![0] = Number.NaN;
    expect(() => mapTaskResult(nonFinite, 2)).toThrow('latency.samples[0]');

    const nonPositive = createCompletedResult();
    nonPositive.latency.samples![0] = 0;
    expect(() => mapTaskResult(nonPositive, 2)).toThrow('greater than zero');
  });

  it('rejects non-finite location statistics and negative dispersion statistics', () => {
    const nonFinite = createCompletedResult();
    nonFinite.latency.mean = Number.POSITIVE_INFINITY;
    expect(() => mapTaskResult(nonFinite, 2)).toThrow('latency.mean');

    const negative = createCompletedResult();
    negative.latency.sd = -1;
    expect(() => mapTaskResult(negative, 2)).toThrow('latency.sd');
  });
});
