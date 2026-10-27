import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from 'storybook/internal/client-logger';
import { deepSignal } from 'deepsignal/core';

import type { EntryStamp, JsonPatchOperation } from './service-channel.ts';
import {
  applyStatePatch,
  compareStamps,
  createReconciler,
  vectorDominates,
  vectorsConcurrent,
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

  // A JSON object literal would make `__proto__` set the prototype rather than an own key, so the
  // guard would never run. `JSON.parse` produces real own `__proto__`/`constructor`/`prototype`
  // keys, which is exactly the untrusted payload shape that reaches this code from static files and
  // channel snapshots.
  const pollutionSource = () =>
    JSON.parse(
      '{"__proto__":{"polluted":true},"constructor":{"polluted":true},"prototype":{"polluted":true},"safe":"updated"}'
    ) as Record<string, unknown>;

  it('skips prototype-pollution keys in a partial snapshot', () => {
    const target = { safe: 'ok' };

    applyStatePatch(target, pollutionSource(), { preserveMissingKeys: true });

    expect(target).toEqual({ safe: 'updated' });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect((Object.getPrototypeOf({}) as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('skips prototype-pollution keys in a full snapshot', () => {
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

describe('vectorDominates', () => {
  it('treats a non-empty vector as dominating an empty one, and not the reverse', () => {
    expect(vectorDominates({ a: 1 }, {})).toBe(true);
    expect(vectorDominates({}, { a: 1 })).toBe(false);
    expect(vectorDominates({}, {})).toBe(false);
    expect(vectorDominates({ a: 0 }, { b: 0 })).toBe(false);
  });

  it('requires every counter at least equal and at least one greater', () => {
    expect(vectorDominates({ a: 2, b: 1 }, { a: 1, b: 1 })).toBe(true);
    expect(vectorDominates({ a: 1, b: 1 }, { a: 1, b: 1 })).toBe(false);
    expect(vectorDominates({ a: 2, b: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(vectorsConcurrent({ a: 2, b: 1 }, { a: 1, b: 2 })).toBe(true);
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
    expect(compareStamps(stamp('A', 1, 1), stamp('a', 1, 1))).toBeLessThan(0);
    expect(compareStamps(stamp('a', 1, 1), stamp('A', 1, 1))).toBeGreaterThan(0);
  });
});

describe('createReconciler entries', () => {
  beforeEach(() => {
    vi.mocked(logger.debug).mockReset();
    vi.mocked(logger.warn).mockReset();
    vi.mocked(logger.debug).mockImplementation(() => undefined);
    vi.mocked(logger.warn).mockImplementation(() => undefined);
  });

  function fixture(
    initial: Record<string, unknown> = {},
    window?: { maxAgeMs?: number; maxEntries?: number }
  ) {
    const state = initial;
    const reconciler = createReconciler({
      serviceId: 'svc',
      setState: (mutate) => {
        mutate(state);
      },
      window,
    });
    return { state, reconciler };
  }

  it('stamps a local write with seq = clock + 1 and advances the clock', () => {
    const { reconciler } = fixture({ n: 0 });
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

  it('drops covered log entries on install and treats their counters as duplicates', () => {
    const { state, reconciler } = fixture({ n: 0, extra: 0 });
    expect(
      reconciler.tryPlaceEntry({
        serviceId: 'svc',
        stamp: stamp('writer', 1, 2),
        command: 'setN',
        patch: [{ op: 'replace', path: '/n', value: 2 }],
      })
    ).toBe('accepted');
    expect(state.n).toBe(2);

    expect(reconciler.tryInstall({ vector: { writer: 2 }, clock: 10 }, { n: 99, extra: 0 })).toBe(
      'installed'
    );
    expect(state).toEqual({ n: 99, extra: 0 });
    expect(reconciler.log).toEqual([]);
    expect(reconciler.vector).toEqual({ writer: 2 });

    expect(
      reconciler.tryPlaceEntry({
        serviceId: 'svc',
        stamp: stamp('writer', 1, 1),
        command: 'setExtra',
        patch: [{ op: 'replace', path: '/extra', value: 1 }],
      })
    ).toBe('duplicate');
    expect(state).toEqual({ n: 99, extra: 0 });
    expect(reconciler.log).toEqual([]);
  });

  it('re-applies uncovered log entries in canonical order after install', () => {
    const { state, reconciler } = fixture({ n: 0, mine: 0 });
    expect(
      reconciler.tryPlaceEntry({
        serviceId: 'svc',
        stamp: stamp('peer', 1, 1),
        command: 'setN',
        patch: [{ op: 'replace', path: '/n', value: 1 }],
      })
    ).toBe('accepted');
    expect(
      reconciler.tryPlaceEntry({
        serviceId: 'svc',
        stamp: stamp('zzz', 2, 5),
        command: 'setMine',
        patch: [{ op: 'replace', path: '/mine', value: 'Z' }],
      })
    ).toBe('gap');
    expect(
      reconciler.tryPlaceEntry({
        serviceId: 'svc',
        stamp: stamp('aaa', 2, 5),
        command: 'setMine',
        patch: [{ op: 'replace', path: '/mine', value: 'A' }],
      })
    ).toBe('gap');
    expect(state.mine).toBe('Z');

    expect(reconciler.tryInstall({ vector: { peer: 4 }, clock: 4 }, { n: 4, mine: 0 })).toBe(
      'installed'
    );
    expect(state).toEqual({ n: 4, mine: 'Z' });
    expect(reconciler.log.map((entry) => entry.stamp.runtimeId)).toEqual(['aaa', 'zzz']);
    expect(reconciler.vector).toEqual({ peer: 4 });
    expect(reconciler.clock).toBe(5);
  });

  it('places a peer entry between the reply clock and a higher local clock as an earlier insert, not beyond-window', () => {
    const { state, reconciler } = fixture({});
    // A gap entry moves the clock but not the Vector, so a reply can dominate the empty Vector
    // while its clock trails the local one.
    expect(
      reconciler.tryPlaceEntry({
        serviceId: 'svc',
        stamp: stamp('far', 2, 9),
        command: 'setFar',
        patch: [{ op: 'add', path: '/far', value: 1 }],
      })
    ).toBe('gap');
    expect(reconciler.clock).toBe(9);

    expect(reconciler.tryInstall({ vector: { peer: 2 }, clock: 3 }, { peer: 'p' })).toBe(
      'installed'
    );
    expect(state).toEqual({ peer: 'p', far: 1 });

    expect(
      reconciler.tryPlaceEntry({
        serviceId: 'svc',
        stamp: stamp('other', 1, 5),
        command: 'setOther',
        patch: [{ op: 'add', path: '/other', value: 5 }],
      })
    ).toBe('accepted');
    expect(state).toEqual({ peer: 'p', far: 1, other: 5 });
  });

  it('drops an uncovered gap entry at or below the reply clock on install instead of re-applying it over the snapshot', () => {
    const gap = {
      serviceId: 'svc',
      stamp: stamp('w', 2, 2),
      command: 'setX',
      patch: [{ op: 'replace' as const, path: '/x', value: 'g' }],
    };
    const later = {
      serviceId: 'svc',
      stamp: stamp('z', 1, 3),
      command: 'setX',
      patch: [{ op: 'replace' as const, path: '/x', value: 'L' }],
    };

    const replier = fixture({ x: '0' });
    expect(replier.reconciler.tryPlaceEntry(gap)).toBe('gap');
    expect(replier.reconciler.tryPlaceEntry(later)).toBe('accepted');
    expect(replier.state.x).toBe('L');

    const requester = fixture({ x: '0' });
    expect(requester.reconciler.tryPlaceEntry(gap)).toBe('gap');
    expect(requester.reconciler.tryInstall(replier.reconciler.frontier, { ...replier.state })).toBe(
      'installed'
    );

    expect(requester.reconciler.vector).toEqual(replier.reconciler.vector);
    expect(requester.state.x).toBe('L');
    expect(requester.reconciler.log).toEqual([]);
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.stringContaining(
        'dropped on install. service=svc stamp=2:w:2 clock=3 paths=/x command=setX'
      )
    );
    expect(requester.reconciler.tryPlaceEntry(gap)).toBe('beyond-window');
    expect(requester.state.x).toBe('L');
  });

  it('sets the reply-clock floor to the installed reply clock, so a later reply with a lower clock reopens placeable seqs', () => {
    const { state, reconciler } = fixture({ x: '0' });
    // The first replier holds a gap at seq 10, so its clock is 10 while its vector is { a: 1 }.
    expect(reconciler.tryInstall({ vector: { a: 1 }, clock: 10 }, { x: 'a', g: 'g' })).toBe(
      'installed'
    );
    // The second replier folded a:1 and b:1 (seq 3) and never saw seq 10.
    expect(reconciler.tryInstall({ vector: { a: 1, b: 1 }, clock: 3 }, { x: 'b' })).toBe(
      'installed'
    );
    expect(state).toEqual({ x: 'b' });

    // Everything in the state now has seq <= 3, so seq 5 sorts after all of it.
    expect(
      reconciler.tryPlaceEntry({
        serviceId: 'svc',
        stamp: stamp('c', 1, 5),
        command: 'setC',
        patch: [{ op: 'add', path: '/c', value: 'c' }],
      })
    ).toBe('accepted');
    expect(state).toEqual({ x: 'b', c: 'c' });
  });

  it('treats a redelivered beyond-window stamp as a duplicate until the next install', () => {
    const { reconciler } = fixture({ x: '0' });
    expect(reconciler.tryInstall({ vector: { a: 1 }, clock: 5 }, { x: 'a' })).toBe('installed');
    const stale = {
      serviceId: 'svc',
      stamp: stamp('b', 1, 4),
      command: 'setX',
      patch: [{ op: 'replace' as const, path: '/x', value: 'b' }],
    };
    expect(reconciler.tryPlaceEntry(stale)).toBe('beyond-window');
    expect(reconciler.tryPlaceEntry(stale)).toBe('duplicate');

    expect(reconciler.tryInstall({ vector: { a: 1, c: 1 }, clock: 2 }, { x: 'c' })).toBe(
      'installed'
    );
    expect(reconciler.tryPlaceEntry(stale)).toBe('accepted');
  });

  it('does not install a snapshot that does not dominate', () => {
    const { state, reconciler } = fixture({ n: 0 });
    expect(
      reconciler.tryPlaceEntry({
        serviceId: 'svc',
        stamp: stamp('writer', 1, 1),
        command: 'setN',
        patch: [{ op: 'replace', path: '/n', value: 1 }],
      })
    ).toBe('accepted');
    expect(reconciler.log).toHaveLength(1);

    expect(reconciler.tryInstall({ vector: {}, clock: 0 }, { n: 99 })).not.toBe('installed');
    expect(state.n).toBe(1);
    expect(reconciler.log).toHaveLength(1);
  });

  it('raises the clock to an installed frontier so the next local seq is later', () => {
    const { reconciler } = fixture({ value: '' });
    expect(reconciler.tryInstall({ vector: { peer: 2 }, clock: 3 }, { value: '' })).toBe(
      'installed'
    );
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

  it('rejects a concurrent snapshot but still raises the clock to its frontier', () => {
    const { state, reconciler } = fixture({ n: 0, m: 0 });
    expect(
      reconciler.tryPlaceEntry({
        serviceId: 'svc',
        stamp: stamp('aaa', 1, 1),
        command: 'setN',
        patch: [{ op: 'replace', path: '/n', value: 1 }],
      })
    ).toBe('accepted');

    const reply = { vector: { zzz: 1 }, clock: 2 };
    expect(reconciler.tryInstall(reply, { n: 0, m: 9 })).toBe('concurrent');
    expect(state).toEqual({ n: 1, m: 0 });
    expect(reconciler.frontier.clock).toBe(2);
  });

  it('drops a duplicate stamp including the local echo, and still advances the clock', () => {
    const { state, reconciler } = fixture({ n: 0 });
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
      reconciler.tryPlaceEntry({
        serviceId: 'svc',
        stamp: local,
        command: 'setN',
        patch: [{ op: 'replace', path: '/n', value: 99 }],
      })
    ).toBe('duplicate');
    expect(state.n).toBe(1);
    expect(reconciler.clock).toBe(1);

    expect(
      reconciler.tryPlaceEntry({
        serviceId: 'svc',
        stamp: stamp('self', 1, 9),
        command: 'setN',
        patch: [{ op: 'replace', path: '/n', value: 99 }],
      })
    ).toBe('duplicate');
    expect(state.n).toBe(1);
    expect(reconciler.clock).toBe(9);
  });

  it('drops every stamp of a writer once a gap has been filled, in any arrival order', () => {
    for (const order of [
      [1, 3, 2],
      [2, 3, 1],
      [3, 1, 2],
    ]) {
      const { state, reconciler } = fixture();
      const entry = (counter: number) => ({
        serviceId: 'svc',
        stamp: stamp('w', counter, counter),
        command: 'set',
        patch: [{ op: 'add' as const, path: `/k${counter}`, value: counter }],
      });

      for (const counter of order) {
        expect(reconciler.tryPlaceEntry(entry(counter))).not.toBe('duplicate');
      }
      for (const counter of order) {
        expect(reconciler.tryPlaceEntry(entry(counter))).toBe('duplicate');
      }
      expect(state).toEqual({ k1: 1, k2: 2, k3: 3 });
    }
  });

  it('treats a redelivered gap that the window already evicted as beyond-window', () => {
    vi.useFakeTimers();
    try {
      const { state, reconciler } = fixture({}, { maxAgeMs: 0, maxEntries: 1 });
      const gap = {
        serviceId: 'svc',
        stamp: stamp('w', 2, 2),
        command: 'setB',
        patch: [{ op: 'add' as const, path: '/b', value: 'first' }],
      };
      expect(reconciler.tryPlaceEntry(gap)).toBe('gap');
      vi.advanceTimersByTime(1);
      expect(
        reconciler.tryPlaceEntry({
          serviceId: 'svc',
          stamp: stamp('w', 3, 3),
          command: 'setC',
          patch: [{ op: 'add', path: '/c', value: 3 }],
        })
      ).toBe('gap');
      expect(reconciler.log.map((entry) => entry.stamp.counter)).toEqual([3]);

      state.b = 'changed locally';
      expect(reconciler.tryPlaceEntry(gap)).toBe('beyond-window');
      expect(state).toEqual({ b: 'changed locally', c: 3 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('applies a gap without advancing the vector so the skipped counter still applies, and warns', () => {
    const { state, reconciler } = fixture();

    expect(
      reconciler.tryPlaceEntry({
        serviceId: 'svc',
        stamp: stamp('w', 2, 2),
        command: 'setB',
        patch: [{ op: 'add', path: '/b', value: 2 }],
      })
    ).toBe('gap');
    expect(state).toEqual({ b: 2 });
    expect(reconciler.vector).toEqual({});
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.stringContaining('service=svc stamps=2:w:2 paths=/b command=setB')
    );

    expect(
      reconciler.tryPlaceEntry({
        serviceId: 'svc',
        stamp: stamp('w', 1, 1),
        command: 'setA',
        patch: [{ op: 'add', path: '/a', value: 1 }],
      })
    ).toBe('accepted');
    expect(state).toEqual({ b: 2, a: 1 });
    expect(reconciler.vector).toEqual({ w: 2 });
  });

  it('warns with service, stamp, path, and command on missing parent and keeps the entry as an unapplied no-op', () => {
    const { state, reconciler } = fixture({ a: 1 });

    expect(
      reconciler.tryPlaceEntry({
        serviceId: 'svc',
        stamp: stamp('writer', 1),
        command: 'setNested',
        patch: [{ op: 'add', path: '/missing/y', value: 3 }],
      })
    ).toBe('unapplied');
    expect(state).toEqual({ a: 1 });
    expect(reconciler.has(stamp('writer', 1))).toBe(true);
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.stringContaining('service=svc stamp=1:writer:1 path=/missing/y command=setNested')
    );
  });

  it('applies a kept missing-parent no-op when an earlier insert supplies the parent', () => {
    const { state, reconciler } = fixture();

    expect(
      reconciler.tryPlaceEntry({
        serviceId: 'svc',
        stamp: stamp('writer', 2, 2),
        command: 'setNested',
        patch: [{ op: 'add', path: '/parent/y', value: 3 }],
      })
    ).toBe('gap');
    expect(state).toEqual({});
    expect(reconciler.has(stamp('writer', 2, 2))).toBe(true);

    expect(
      reconciler.tryPlaceEntry({
        serviceId: 'svc',
        stamp: stamp('writer', 1, 1),
        command: 'addParent',
        patch: [{ op: 'add', path: '/parent', value: {} }],
      })
    ).toBe('accepted');
    expect(state).toEqual({ parent: { y: 3 } });
  });

  it('debug-logs remove of a missing key and still accepts the entry', () => {
    const { state, reconciler } = fixture({ n: 1 });

    expect(
      reconciler.tryPlaceEntry({
        serviceId: 'svc',
        stamp: stamp('writer', 1),
        command: 'clearM',
        patch: [{ op: 'remove', path: '/m' }],
      })
    ).toBe('accepted');
    expect(state).toEqual({ n: 1 });
    expect(vi.mocked(logger.debug)).toHaveBeenCalledWith(
      expect.stringContaining('service=svc stamp=1:writer:1 path=/m command=clearM')
    );
  });

  it('drops a beyond-window entry and warns with service, stamps, paths, and command', () => {
    const { state, reconciler } = fixture({}, { maxAgeMs: 0, maxEntries: 2 });

    expect(
      reconciler.tryPlaceEntry({
        serviceId: 'svc',
        stamp: stamp('w', 1, 1),
        command: 'setA',
        patch: [{ op: 'add', path: '/a', value: 1 }],
      })
    ).toBe('accepted');
    expect(
      reconciler.tryPlaceEntry({
        serviceId: 'svc',
        stamp: stamp('w', 2, 2),
        command: 'setB',
        patch: [{ op: 'add', path: '/b', value: 2 }],
      })
    ).toBe('accepted');
    expect(
      reconciler.tryPlaceEntry({
        serviceId: 'svc',
        stamp: stamp('w', 3, 3),
        command: 'setC',
        patch: [{ op: 'add', path: '/c', value: 3 }],
      })
    ).toBe('accepted');

    expect(reconciler.log.map((entry) => entry.stamp.seq)).toEqual([2, 3]);

    expect(
      reconciler.tryPlaceEntry({
        serviceId: 'svc',
        stamp: stamp('other', 1, 1),
        command: 'setZ',
        patch: [{ op: 'add', path: '/z', value: 9 }],
      })
    ).toBe('beyond-window');
    expect(state).toEqual({ a: 1, b: 2, c: 3 });
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.stringContaining('service=svc stamps=1:other:1,1:w:1 paths=/z command=setZ')
    );
  });

  it('installs a snapshot without the reserved keys deepsignal throws on', () => {
    const { state, reconciler } = fixture(
      deepSignal({ a: 1, nested: { b: 2 } }) as Record<string, unknown>
    );

    expect(
      reconciler.tryInstall(
        { vector: { peer: 1 }, clock: 5 },
        { a: 99, nested: { $y: 1 }, fresh: { $y: 1 }, list: [{ $y: 1 }] }
      )
    ).toBe('installed');

    expect(JSON.parse(JSON.stringify(state))).toEqual({
      a: 99,
      nested: {},
      fresh: {},
      list: [{}],
    });
  });

  it('undoes later entries newest first, so an earlier insert applies to the state before them', () => {
    const { state, reconciler } = fixture({ n: {} });
    for (const [counter, value] of [
      [1, 5],
      [2, 6],
    ]) {
      reconciler.tryPlaceEntry({
        serviceId: 'svc',
        stamp: stamp('z', counter),
        command: 'setN',
        patch: [{ op: 'replace', path: '/n', value }],
      });
    }

    expect(
      reconciler.tryPlaceEntry({
        serviceId: 'svc',
        stamp: stamp('a', 1),
        command: 'setK',
        patch: [{ op: 'add', path: '/n/k', value: 'a' }],
      })
    ).toBe('accepted');
    expect(state).toEqual({ n: 6 });
  });

  it('turns a later write into a no-op when an earlier insert removes its parent, in either arrival order', () => {
    const removeParent = {
      serviceId: 'svc',
      stamp: stamp('a', 1),
      command: 'removeP',
      patch: [{ op: 'remove' as const, path: '/p' }],
    };
    const writeChild = {
      serviceId: 'svc',
      stamp: stamp('z', 1),
      command: 'setK',
      patch: [{ op: 'add' as const, path: '/p/k', value: 'v' }],
    };
    const earliest = {
      serviceId: 'svc',
      stamp: stamp('0', 1),
      command: 'setM',
      patch: [{ op: 'add' as const, path: '/m', value: 1 }],
    };

    const inOrder = fixture({ p: {} });
    expect(inOrder.reconciler.tryPlaceEntry(removeParent)).toBe('accepted');
    expect(inOrder.reconciler.tryPlaceEntry(writeChild)).toBe('unapplied');

    const reversed = fixture({ p: {} });
    expect(reversed.reconciler.tryPlaceEntry(writeChild)).toBe('accepted');
    expect(reversed.reconciler.tryPlaceEntry(removeParent)).toBe('accepted');
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.stringContaining('replay failed. service=svc stamp=1:z:1 path=/p/k command=setK')
    );

    for (const { reconciler } of [inOrder, reversed]) {
      vi.mocked(logger.warn).mockClear();
      expect(reconciler.tryPlaceEntry(earliest)).toBe('accepted');
      expect(vi.mocked(logger.warn)).not.toHaveBeenCalledWith(
        expect.stringContaining('undo failed')
      );
    }
    expect(inOrder.state).toEqual({ m: 1 });
    expect(reversed.state).toEqual(inOrder.state);
    expect(reversed.reconciler.log).toEqual(inOrder.reconciler.log);
  });

  it('clears the evicted-stamp floor on install, so an entry above the reply clock still places', () => {
    const { state, reconciler } = fixture({}, { maxAgeMs: 0, maxEntries: 1 });
    for (const [counter, seq] of [
      [2, 9],
      [3, 10],
    ]) {
      expect(
        reconciler.tryPlaceEntry({
          serviceId: 'svc',
          stamp: stamp('w', counter, seq),
          command: 'setW',
          patch: [{ op: 'add', path: `/w${counter}`, value: counter }],
        })
      ).toBe('gap');
    }
    expect(reconciler.tryInstall({ vector: { r: 1 }, clock: 3 }, { r: 1 })).toBe('installed');

    expect(
      reconciler.tryPlaceEntry({
        serviceId: 'svc',
        stamp: stamp('x', 1, 8),
        command: 'setX',
        patch: [{ op: 'add', path: '/x', value: 8 }],
      })
    ).toBe('accepted');
    expect(state).toEqual({ r: 1, w3: 3, x: 8 });
  });

  it('remembers every dropped stamp until the next install, even past the window entry count', () => {
    const { reconciler } = fixture({}, { maxEntries: 1 });
    expect(reconciler.tryInstall({ vector: { a: 1 }, clock: 5 }, {})).toBe('installed');
    const stale = (runtimeId: string, seq: number) => ({
      serviceId: 'svc',
      stamp: stamp(runtimeId, 1, seq),
      command: 'set',
      patch: [{ op: 'add' as const, path: `/${runtimeId}`, value: seq }],
    });

    expect(reconciler.tryPlaceEntry(stale('b', 4))).toBe('beyond-window');
    expect(reconciler.tryPlaceEntry(stale('c', 3))).toBe('beyond-window');

    expect(reconciler.tryPlaceEntry(stale('c', 3))).toBe('duplicate');
    expect(reconciler.tryPlaceEntry(stale('b', 4))).toBe('duplicate');
  });
});

describe('createReconciler with a subscriber that throws', () => {
  beforeEach(() => {
    vi.mocked(logger.warn).mockReset();
    vi.mocked(logger.warn).mockImplementation(() => undefined);
  });

  it('logs an entry it applied even when a subscriber throws at the end of the batch', () => {
    const state: Record<string, unknown> = { x: 0, p: {} };
    let subscriberThrows = true;
    const reconciler = createReconciler({
      serviceId: 'svc',
      // `applyLocal` runs subscribers when its batch ends, after the mutation, and rethrows.
      setState: (mutate) => {
        mutate(state);
        if (subscriberThrows) {
          subscriberThrows = false;
          throw new Error('subscriber');
        }
      },
    });
    const write = {
      serviceId: 'svc',
      stamp: stamp('z', 1, 2),
      command: 'setBoth',
      patch: [
        { op: 'replace' as const, path: '/x', value: 1 },
        { op: 'add' as const, path: '/p/k', value: 'v' },
      ],
    };

    expect(() => reconciler.tryPlaceEntry(write)).toThrow('subscriber');
    reconciler.tryPlaceEntry(write);
    reconciler.tryPlaceEntry({
      serviceId: 'svc',
      stamp: stamp('a', 1, 1),
      command: 'removeP',
      patch: [{ op: 'remove', path: '/p' }],
    });

    expect(state).toEqual({ x: 0 });
    expect(reconciler.vector).toEqual({ a: 1, z: 1 });
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
    const reconciler = createReconciler({
      serviceId: 'svc',
      setState: (mutate) => mutate(state),
      window: { maxAgeMs: 15_000, maxEntries: 2 },
    });

    for (let counter = 1; counter <= 5; counter += 1) {
      reconciler.tryPlaceEntry({
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
    const reconciler = createReconciler({
      serviceId: 'svc',
      setState: (mutate) => mutate(state),
      window: { maxAgeMs: 15_000, maxEntries: 2 },
    });

    for (let counter = 1; counter <= 5; counter += 1) {
      reconciler.tryPlaceEntry({
        serviceId: 'svc',
        stamp: stamp('w', counter, counter),
        command: 'setN',
        patch: [{ op: 'replace', path: '/n', value: counter }],
      });
    }

    vi.advanceTimersByTime(15_001);
    reconciler.tryPlaceEntry({
      serviceId: 'svc',
      stamp: stamp('w', 6, 6),
      command: 'setN',
      patch: [{ op: 'replace', path: '/n', value: 6 }],
    });

    expect(reconciler.log.map((entry) => entry.stamp.seq)).toEqual([5, 6]);
  });

  it('drops a redelivered evicted entry even when a younger entry with a lower stamp is retained', () => {
    const state: Record<string, unknown> = {};
    const reconciler = createReconciler({
      setState: (mutate) => mutate(state),
      serviceId: 'svc',
      window: { maxAgeMs: 15_000, maxEntries: 2 },
    });
    const entry = (writer: string, counter: number, seq = counter) => ({
      serviceId: 'svc',
      stamp: stamp(writer, counter, seq),
      command: 'set',
      patch: [{ op: 'add' as const, path: `/${seq}${writer}`, value: seq }],
    });
    const stamps = () => reconciler.log.map((item) => `${item.stamp.seq}:${item.stamp.runtimeId}`);

    reconciler.tryPlaceEntry(entry('a', 3));
    reconciler.tryPlaceEntry(entry('a', 4));
    reconciler.tryPlaceEntry(entry('a', 5));
    vi.advanceTimersByTime(15_001);
    reconciler.tryPlaceEntry(entry('b', 1));
    expect(stamps()).toEqual(['1:b', '4:a', '5:a']);

    expect(reconciler.tryPlaceEntry(entry('a', 3))).toBe('beyond-window');
    expect(reconciler.tryPlaceEntry(entry('c', 1, 2))).toBe('beyond-window');
    expect(reconciler.tryPlaceEntry(entry('c', 1, 3))).toBe('accepted');
    expect(stamps()).toEqual(['1:b', '3:c', '4:a', '5:a']);
  });
});
