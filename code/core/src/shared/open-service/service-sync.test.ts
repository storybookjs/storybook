import { batch, effect } from '@preact/signals-core';
import { deepSignal } from 'deepsignal/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from 'storybook/internal/client-logger';

import type { EntryStamp, JsonPatchOperation } from './service-channel.ts';
import {
  applyStatePatch,
  compareStamps,
  createSnapshotReconciler,
  DEFAULT_LOG_MAX_ENTRIES,
  type AuthoredEntry,
} from './service-sync.ts';

vi.mock('storybook/internal/client-logger', { spy: true });

function stamp(runtimeId: string, counter: number, seq = counter): EntryStamp {
  return { seq, runtimeId, counter };
}

function authored(
  command: string,
  patch: JsonPatchOperation[],
  inverse: JsonPatchOperation[]
): AuthoredEntry {
  return { command, patch, inverse };
}

describe('applyStatePatch', () => {
  it('merges nested objects without deleting sibling keys', () => {
    const target = { entries: { alpha: 'a', beta: 'b' } };
    const source = { entries: { gamma: 'c' } };

    applyStatePatch(target as Record<string, unknown>, source as Record<string, unknown>, {
      preserveMissingKeys: true,
    });

    expect(target).toEqual({ entries: { alpha: 'a', beta: 'b', gamma: 'c' } });
  });

  it('replaces primitive values when the source differs', () => {
    const target = { value: 'old' };
    const source = { value: 'new' };

    applyStatePatch(target, source, { preserveMissingKeys: true });

    expect(target).toEqual({ value: 'new' });
  });

  // A JSON object literal would make `__proto__` set the prototype rather than an own key, so the
  // guard would never run. `JSON.parse` produces real own `__proto__`/`constructor`/`prototype`
  // keys, which is exactly the untrusted payload shape that reaches this code from static files and
  // channel snapshots.
  const pollutionSource = () =>
    JSON.parse(
      '{"__proto__":{"polluted":true},"constructor":{"polluted":true},"prototype":{"polluted":true},"safe":"updated"}'
    ) as Record<string, unknown>;

  it('skips prototype-pollution keys when preserving missing keys', () => {
    const target = { safe: 'ok' };

    applyStatePatch(target, pollutionSource(), { preserveMissingKeys: true });

    expect(target).toEqual({ safe: 'updated' });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect((Object.getPrototypeOf({}) as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('skips prototype-pollution keys when deleting missing keys', () => {
    const target = { safe: 'ok' };

    applyStatePatch(target, pollutionSource(), { preserveMissingKeys: false });

    expect(target).toEqual({ safe: 'updated' });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect((Object.getPrototypeOf({}) as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('deletes nested keys missing from the source snapshot', () => {
    const target = { entries: { alpha: 'a', beta: 'b' }, untouched: true };
    const source = { entries: { alpha: 'updated' } };

    applyStatePatch(target as Record<string, unknown>, source as Record<string, unknown>, {
      preserveMissingKeys: false,
    });

    expect(target).toEqual({ entries: { alpha: 'updated' } });
  });
});

describe('compareStamps', () => {
  it('orders by seq first, then by plain string runtimeId', () => {
    expect(compareStamps(stamp('zzz', 1, 1), stamp('aaa', 1, 2))).toBeLessThan(0);
    expect(compareStamps(stamp('aaa', 1, 2), stamp('zzz', 1, 1))).toBeGreaterThan(0);
    expect(compareStamps(stamp('aaa', 1, 1), stamp('zzz', 1, 1))).toBeLessThan(0);
    expect(compareStamps(stamp('zzz', 1, 1), stamp('aaa', 1, 1))).toBeGreaterThan(0);
    expect(compareStamps(stamp('same', 1, 1), stamp('same', 2, 1))).toBe(0);
  });

  it('breaks runtimeId ties with plain string order, not localeCompare', () => {
    expect('A' < 'a').toBe(true);
    expect(compareStamps(stamp('A', 1, 1), stamp('a', 1, 1))).toBeLessThan(0);
    expect(compareStamps(stamp('a', 1, 1), stamp('A', 1, 1))).toBeGreaterThan(0);
  });
});

describe('createSnapshotReconciler entries', () => {
  beforeEach(() => {
    vi.mocked(logger.debug).mockReset();
    vi.mocked(logger.warn).mockReset();
    vi.mocked(logger.debug).mockImplementation(() => undefined);
    vi.mocked(logger.warn).mockImplementation(() => undefined);
  });

  function createReconciler(
    initial: Record<string, unknown> = {},
    window?: { maxAgeMs?: number; maxEntries?: number }
  ) {
    const state = initial;
    const reconciler = createSnapshotReconciler({
      setState: (mutate) => {
        mutate(state);
      },
      initialStamp: { version: 0, runtimeId: 'self' },
      window,
    });
    return { state, reconciler };
  }

  it('stamps a local write with seq = clock + 1 and advances the clock', () => {
    const { reconciler } = createReconciler({ n: 0 });
    const first = reconciler.advanceLocal(
      'self',
      authored(
        'setN',
        [{ op: 'replace', path: '/n', value: 1 }],
        [{ op: 'replace', path: '/n', value: 0 }]
      )
    );
    expect(first).toEqual({ seq: 1, runtimeId: 'self', counter: 1 });
    expect(reconciler.clock).toBe(1);

    const second = reconciler.advanceLocal(
      'self',
      authored(
        'setN',
        [{ op: 'replace', path: '/n', value: 2 }],
        [{ op: 'replace', path: '/n', value: 1 }]
      )
    );
    expect(second).toEqual({ seq: 2, runtimeId: 'self', counter: 2 });
    expect(reconciler.clock).toBe(2);
  });

  it('does not replay retained log entries across an adopted snapshot', () => {
    const { state, reconciler } = createReconciler({ n: 0, extra: 0 });
    expect(
      reconciler.tryAdoptEntry({
        serviceId: 'svc',
        stamp: stamp('writer', 1, 2),
        command: 'setN',
        patch: [{ op: 'replace', path: '/n', value: 2 }],
      })
    ).toBe(true);
    expect(state.n).toBe(2);

    expect(reconciler.tryAdopt({ version: 10, runtimeId: 'peer' }, { n: 99, extra: 0 })).toBe(true);
    expect(state).toEqual({ n: 99, extra: 0 });
    expect(reconciler.log).toEqual([]);

    expect(
      reconciler.tryAdoptEntry({
        serviceId: 'svc',
        stamp: stamp('other', 1, 1),
        command: 'setExtra',
        patch: [{ op: 'replace', path: '/extra', value: 1 }],
      })
    ).toBe(false);
    expect(state).toEqual({ n: 99, extra: 0 });
    expect(reconciler.log).toEqual([]);
  });

  it('still places an entry later than an adopted snapshot', () => {
    const { state, reconciler } = createReconciler({ n: 0 });
    expect(reconciler.tryAdopt({ version: 10, runtimeId: 'peer' }, { n: 99 })).toBe(true);

    expect(
      reconciler.tryAdoptEntry({
        serviceId: 'svc',
        stamp: stamp('writer', 1, 11),
        command: 'setN',
        patch: [{ op: 'replace', path: '/n', value: 11 }],
      })
    ).toBe(true);
    expect(state.n).toBe(11);
    expect(reconciler.log).toHaveLength(1);
  });

  it('keeps the log when a bootstrap snapshot loses last-write-wins', () => {
    const { state, reconciler } = createReconciler({ n: 0 });
    expect(
      reconciler.tryAdoptEntry({
        serviceId: 'svc',
        stamp: stamp('writer', 1, 1),
        command: 'setN',
        patch: [{ op: 'replace', path: '/n', value: 1 }],
      })
    ).toBe(true);
    expect(reconciler.log).toHaveLength(1);

    expect(reconciler.tryAdopt({ version: 0, runtimeId: 'stale' }, { n: 99 })).toBe(false);
    expect(state.n).toBe(1);
    expect(reconciler.log).toHaveLength(1);
  });

  it('raises the clock to an adopted snapshot version so the next local seq is later', () => {
    const { reconciler } = createReconciler({ value: '' });
    expect(reconciler.tryAdopt({ version: 3, runtimeId: 'peer' }, { value: '' })).toBe(true);
    expect(reconciler.clock).toBe(3);

    const local = reconciler.advanceLocal(
      'self',
      authored(
        'setValue',
        [{ op: 'replace', path: '/value', value: 'after join' }],
        [{ op: 'replace', path: '/value', value: '' }]
      )
    );
    expect(local).toEqual({ seq: 4, runtimeId: 'self', counter: 1 });
    expect(reconciler.clock).toBe(4);
  });

  it('does not let leftover later log entries clobber a post-bootstrap local write', () => {
    const server = createReconciler({ value: '' });
    expect(
      server.reconciler.tryAdoptEntry({
        serviceId: 'svc',
        stamp: stamp('old-manager', 1, 1),
        command: 'setValue',
        patch: [{ op: 'replace', path: '/value', value: 'from panel' }],
      })
    ).toBe(true);
    expect(
      server.reconciler.tryAdoptEntry({
        serviceId: 'svc',
        stamp: stamp('old-preview', 1, 2),
        command: 'setValue',
        patch: [{ op: 'replace', path: '/value', value: 'from story' }],
      })
    ).toBe(true);
    expect(
      server.reconciler.tryAdoptEntry({
        serviceId: 'svc',
        stamp: stamp('old-manager', 2, 3),
        command: 'setValue',
        patch: [{ op: 'replace', path: '/value', value: '' }],
      })
    ).toBe(true);
    expect(server.state.value).toBe('');

    const joining = createReconciler({ value: '' });
    expect(
      joining.reconciler.tryAdopt(server.reconciler.stamp, { value: server.state.value })
    ).toBe(true);

    const local = joining.reconciler.advanceLocal(
      'new-preview',
      authored(
        'setValue',
        [{ op: 'replace', path: '/value', value: 'before reload' }],
        [{ op: 'replace', path: '/value', value: '' }]
      )
    );
    expect(local.seq).toBe(4);

    expect(
      server.reconciler.tryAdoptEntry({
        serviceId: 'svc',
        stamp: local,
        command: 'setValue',
        patch: [{ op: 'replace', path: '/value', value: 'before reload' }],
      })
    ).toBe(true);
    expect(server.state.value).toBe('before reload');
  });

  it('keeps snapshot version at least the clock after a gapped seq so a joiner writes later', () => {
    const server = createReconciler({ n: 0 });
    expect(
      server.reconciler.tryAdoptEntry({
        serviceId: 'svc',
        stamp: stamp('w', 1, 100),
        command: 'setN',
        patch: [{ op: 'replace', path: '/n', value: 1 }],
      })
    ).toBe(true);
    expect(server.reconciler.clock).toBe(100);
    expect(server.reconciler.stamp.version).toBeGreaterThanOrEqual(100);

    const joining = createReconciler({ n: 0 });
    expect(joining.reconciler.tryAdopt(server.reconciler.stamp, { n: server.state.n })).toBe(true);
    expect(joining.reconciler.clock).toBeGreaterThanOrEqual(100);

    const local = joining.reconciler.advanceLocal(
      'joiner',
      authored(
        'setN',
        [{ op: 'replace', path: '/n', value: 2 }],
        [{ op: 'replace', path: '/n', value: 1 }]
      )
    );
    expect(local.seq).toBeGreaterThan(100);

    expect(
      server.reconciler.tryAdoptEntry({
        serviceId: 'svc',
        stamp: local,
        command: 'setN',
        patch: [{ op: 'replace', path: '/n', value: 2 }],
      })
    ).toBe(true);
    expect(server.state.n).toBe(2);
  });

  it('advances the clock from a rejected older bootstrap stamp', () => {
    const { reconciler } = createReconciler({ n: 0 });
    for (const runtimeId of ['aaa', 'mmm', 'zzz']) {
      expect(
        reconciler.tryAdoptEntry({
          serviceId: 'svc',
          stamp: stamp(runtimeId, 1, 1),
          command: 'setN',
          patch: [{ op: 'replace', path: '/n', value: runtimeId }],
        })
      ).toBe(true);
    }
    expect(reconciler.clock).toBe(1);
    expect(reconciler.stamp.version).toBe(3);

    expect(reconciler.tryAdopt({ version: 2, runtimeId: 'peer' }, { n: 'stale' })).toBe(false);
    expect(reconciler.clock).toBe(2);
    expect(reconciler.stamp.version).toBe(3);

    const local = reconciler.advanceLocal(
      'self',
      authored(
        'setN',
        [{ op: 'replace', path: '/n', value: 'local' }],
        [{ op: 'replace', path: '/n', value: 'zzz' }]
      )
    );
    expect(local.seq).toBe(3);
  });

  it('drops a duplicate stamp including the local echo, and still advances the clock', () => {
    const { state, reconciler } = createReconciler({ n: 0 });
    const local = reconciler.advanceLocal(
      'self',
      authored(
        'setN',
        [{ op: 'replace', path: '/n', value: 1 }],
        [{ op: 'replace', path: '/n', value: 0 }]
      )
    );
    state.n = 1;

    expect(
      reconciler.tryAdoptEntry({
        serviceId: 'svc',
        stamp: local,
        command: 'setN',
        patch: [{ op: 'replace', path: '/n', value: 99 }],
      })
    ).toBe(false);
    expect(state.n).toBe(1);
    expect(reconciler.clock).toBe(1);

    expect(
      reconciler.tryAdoptEntry({
        serviceId: 'svc',
        stamp: stamp('self', 1, 9),
        command: 'setN',
        patch: [{ op: 'replace', path: '/n', value: 99 }],
      })
    ).toBe(false);
    expect(state.n).toBe(1);
    expect(reconciler.clock).toBe(9);
  });

  it('drops a counter at or below the vector', () => {
    const { state, reconciler } = createReconciler();
    expect(
      reconciler.tryAdoptEntry({
        serviceId: 'svc',
        stamp: stamp('w', 1),
        command: 'setA',
        patch: [{ op: 'add', path: '/a', value: 1 }],
      })
    ).toBe(true);
    expect(
      reconciler.tryAdoptEntry({
        serviceId: 'svc',
        stamp: stamp('w', 1),
        command: 'setA',
        patch: [{ op: 'add', path: '/a', value: 9 }],
      })
    ).toBe(false);
    expect(state).toEqual({ a: 1 });
  });

  it('appends a later entry and records it in the log', () => {
    const { state, reconciler } = createReconciler();
    expect(
      reconciler.tryAdoptEntry({
        serviceId: 'svc',
        stamp: stamp('w', 1, 1),
        command: 'setA',
        patch: [{ op: 'add', path: '/a', value: 1 }],
      })
    ).toBe(true);
    expect(state).toEqual({ a: 1 });
    expect(reconciler.log.map((entry) => entry.stamp)).toEqual([stamp('w', 1, 1)]);
    expect(reconciler.clock).toBe(1);
    expect(reconciler.vector).toEqual({ w: 1 });
  });

  it('places an earlier entry with undo/redo inside one subscriber transition', () => {
    const state = deepSignal({ a: '', b: '' }) as Record<string, unknown> & {
      a: string;
      b: string;
    };
    const reconciler = createSnapshotReconciler({
      setState: (mutate) => {
        batch(() => {
          mutate(state);
        });
      },
      initialStamp: { version: 0, runtimeId: 'self' },
    });

    let transitions = 0;
    const stop = effect(() => {
      void state.a;
      void state.b;
      transitions += 1;
    });
    const afterSubscribe = transitions;

    expect(
      reconciler.tryAdoptEntry({
        serviceId: 'svc',
        stamp: stamp('zzz', 1, 1),
        command: 'setB',
        patch: [{ op: 'replace', path: '/b', value: 'B' }],
      })
    ).toBe(true);
    expect(transitions - afterSubscribe).toBe(1);

    expect(
      reconciler.tryAdoptEntry({
        serviceId: 'svc',
        stamp: stamp('aaa', 1, 1),
        command: 'setA',
        patch: [{ op: 'replace', path: '/a', value: 'A' }],
      })
    ).toBe(true);

    expect(transitions - afterSubscribe).toBe(2);
    expect({ a: state.a, b: state.b }).toEqual({ a: 'A', b: 'B' });
    expect(reconciler.log.map((entry) => entry.stamp.runtimeId)).toEqual(['aaa', 'zzz']);
    stop();
  });

  it('replays earlier same-path writes so the later stamp wins', () => {
    const { state, reconciler } = createReconciler({ n: 0 });

    expect(
      reconciler.tryAdoptEntry({
        serviceId: 'svc',
        stamp: stamp('zzz', 1, 1),
        command: 'setN',
        patch: [{ op: 'replace', path: '/n', value: 'later' }],
      })
    ).toBe(true);
    expect(
      reconciler.tryAdoptEntry({
        serviceId: 'svc',
        stamp: stamp('aaa', 1, 1),
        command: 'setN',
        patch: [{ op: 'replace', path: '/n', value: 'earlier' }],
      })
    ).toBe(true);

    expect(state.n).toBe('later');
  });

  it('applies a gap without advancing the vector so the skipped counter still applies', () => {
    const { state, reconciler } = createReconciler();

    expect(
      reconciler.tryAdoptEntry({
        serviceId: 'svc',
        stamp: stamp('w', 2, 2),
        command: 'setB',
        patch: [{ op: 'add', path: '/b', value: 2 }],
      })
    ).toBe(true);
    expect(state).toEqual({ b: 2 });
    expect(reconciler.vector).toEqual({});
    expect(vi.mocked(logger.warn)).not.toHaveBeenCalled();

    expect(
      reconciler.tryAdoptEntry({
        serviceId: 'svc',
        stamp: stamp('w', 1, 1),
        command: 'setA',
        patch: [{ op: 'add', path: '/a', value: 1 }],
      })
    ).toBe(true);
    expect(state).toEqual({ b: 2, a: 1 });
    expect(reconciler.vector).toEqual({ w: 2 });
    expect(vi.mocked(logger.warn)).not.toHaveBeenCalled();
  });

  it('warns with service, stamp, path, and command on missing parent and does not accept', () => {
    const { state, reconciler } = createReconciler({ a: 1 });

    expect(
      reconciler.tryAdoptEntry({
        serviceId: 'demo',
        stamp: stamp('writer', 1),
        command: 'setNested',
        patch: [{ op: 'add', path: '/missing/y', value: 3 }],
      })
    ).toBe(false);
    expect(state).toEqual({ a: 1 });
    expect(reconciler.has(stamp('writer', 1))).toBe(false);
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.stringContaining('service=demo stamp=1:writer:1 path=/missing/y command=setNested')
    );
  });

  it('debug-logs remove of a missing key and still accepts the entry', () => {
    const { state, reconciler } = createReconciler({ n: 1 });

    expect(
      reconciler.tryAdoptEntry({
        serviceId: 'demo',
        stamp: stamp('writer', 1),
        command: 'clearM',
        patch: [{ op: 'remove', path: '/m' }],
      })
    ).toBe(true);
    expect(state).toEqual({ n: 1 });
    expect(vi.mocked(logger.debug)).toHaveBeenCalledWith(
      expect.stringContaining('service=demo stamp=1:writer:1 path=/m command=clearM')
    );
  });

  it('drops a beyond-window entry and warns with service, stamps, paths, and command', () => {
    const { state, reconciler } = createReconciler({}, { maxAgeMs: 0, maxEntries: 2 });

    expect(
      reconciler.tryAdoptEntry({
        serviceId: 'demo',
        stamp: stamp('w', 1, 1),
        command: 'setA',
        patch: [{ op: 'add', path: '/a', value: 1 }],
      })
    ).toBe(true);
    expect(
      reconciler.tryAdoptEntry({
        serviceId: 'demo',
        stamp: stamp('w', 2, 2),
        command: 'setB',
        patch: [{ op: 'add', path: '/b', value: 2 }],
      })
    ).toBe(true);
    expect(
      reconciler.tryAdoptEntry({
        serviceId: 'demo',
        stamp: stamp('w', 3, 3),
        command: 'setC',
        patch: [{ op: 'add', path: '/c', value: 3 }],
      })
    ).toBe(true);

    expect(reconciler.log.map((entry) => entry.stamp.seq)).toEqual([2, 3]);

    expect(
      reconciler.tryAdoptEntry({
        serviceId: 'demo',
        stamp: stamp('other', 1, 1),
        command: 'setZ',
        patch: [{ op: 'add', path: '/z', value: 9 }],
      })
    ).toBe(false);
    expect(state).toEqual({ a: 1, b: 2, c: 3 });
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.stringContaining('service=demo stamps=1:other:1,2:w:2 paths=/z command=setZ')
    );
  });
});

describe('log window eviction', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(logger.warn).mockReset();
    vi.mocked(logger.warn).mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps entries younger than the age bound even past the count floor', () => {
    const state: Record<string, unknown> = { n: 0 };
    const reconciler = createSnapshotReconciler({
      setState: (mutate) => mutate(state),
      initialStamp: { version: 0, runtimeId: 'self' },
      window: { maxAgeMs: 15_000, maxEntries: 2 },
    });

    for (let counter = 1; counter <= 5; counter += 1) {
      reconciler.tryAdoptEntry({
        serviceId: 'svc',
        stamp: stamp('w', counter, counter),
        command: 'setN',
        patch: [{ op: 'replace', path: '/n', value: counter }],
      });
    }

    expect(reconciler.log).toHaveLength(5);
  });

  it('evicts entries that are both older than the age bound and outside the newest N', () => {
    const state: Record<string, unknown> = { n: 0 };
    const reconciler = createSnapshotReconciler({
      setState: (mutate) => mutate(state),
      initialStamp: { version: 0, runtimeId: 'self' },
      window: { maxAgeMs: 15_000, maxEntries: 2 },
    });

    for (let counter = 1; counter <= 5; counter += 1) {
      reconciler.tryAdoptEntry({
        serviceId: 'svc',
        stamp: stamp('w', counter, counter),
        command: 'setN',
        patch: [{ op: 'replace', path: '/n', value: counter }],
      });
    }

    vi.advanceTimersByTime(15_001);
    reconciler.tryAdoptEntry({
      serviceId: 'svc',
      stamp: stamp('w', 6, 6),
      command: 'setN',
      patch: [{ op: 'replace', path: '/n', value: 6 }],
    });

    expect(reconciler.log.map((entry) => entry.stamp.seq)).toEqual([5, 6]);
    expect(DEFAULT_LOG_MAX_ENTRIES).toBe(256);
  });
});
