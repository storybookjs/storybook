import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from 'storybook/internal/client-logger';

import { applyStatePatch, createSnapshotReconciler } from './service-sync.ts';

vi.mock('storybook/internal/client-logger', { spy: true });

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

describe('createSnapshotReconciler entries', () => {
  beforeEach(() => {
    vi.mocked(logger.debug).mockReset();
    vi.mocked(logger.warn).mockReset();
    vi.mocked(logger.debug).mockImplementation(() => undefined);
    vi.mocked(logger.warn).mockImplementation(() => undefined);
  });

  function createReconciler(initial: Record<string, unknown> = {}) {
    const state = initial;
    const reconciler = createSnapshotReconciler({
      setState: (mutate) => {
        mutate(state);
      },
      initialStamp: { version: 0, runtimeId: 'self' },
    });
    return { state, reconciler };
  }

  it('drops a duplicate stamp including the local echo', () => {
    const { state, reconciler } = createReconciler({ n: 0 });
    const stamp = reconciler.advanceLocal('self');
    state.n = 1;

    expect(
      reconciler.tryAdoptEntry({
        serviceId: 'svc',
        stamp,
        command: 'setN',
        patch: [{ op: 'replace', path: '/n', value: 99 }],
      })
    ).toBe(false);
    expect(state.n).toBe(1);
  });

  it('drops a counter at or below the vector', () => {
    const { state, reconciler } = createReconciler();
    expect(
      reconciler.tryAdoptEntry({
        serviceId: 'svc',
        stamp: { runtimeId: 'w', counter: 1 },
        command: 'setA',
        patch: [{ op: 'add', path: '/a', value: 1 }],
      })
    ).toBe(true);
    expect(
      reconciler.tryAdoptEntry({
        serviceId: 'svc',
        stamp: { runtimeId: 'w', counter: 1 },
        command: 'setA',
        patch: [{ op: 'add', path: '/a', value: 9 }],
      })
    ).toBe(false);
    expect(state).toEqual({ a: 1 });
  });

  it('applies a gap without advancing the vector so the skipped counter still applies', () => {
    const { state, reconciler } = createReconciler();

    expect(
      reconciler.tryAdoptEntry({
        serviceId: 'svc',
        stamp: { runtimeId: 'w', counter: 2 },
        command: 'setB',
        patch: [{ op: 'add', path: '/b', value: 2 }],
      })
    ).toBe(true);
    expect(state).toEqual({ b: 2 });

    expect(
      reconciler.tryAdoptEntry({
        serviceId: 'svc',
        stamp: { runtimeId: 'w', counter: 1 },
        command: 'setA',
        patch: [{ op: 'add', path: '/a', value: 1 }],
      })
    ).toBe(true);
    expect(state).toEqual({ b: 2, a: 1 });
    expect(vi.mocked(logger.warn)).not.toHaveBeenCalled();
  });

  it('warns with service, stamp, path, and command on missing parent and does not accept', () => {
    const { state, reconciler } = createReconciler({ a: 1 });

    expect(
      reconciler.tryAdoptEntry({
        serviceId: 'demo',
        stamp: { runtimeId: 'writer', counter: 1 },
        command: 'setNested',
        patch: [{ op: 'add', path: '/missing/y', value: 3 }],
      })
    ).toBe(false);
    expect(state).toEqual({ a: 1 });
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.stringContaining('service=demo stamp=writer:1 path=/missing/y command=setNested')
    );
  });

  it('debug-logs remove of a missing key and still accepts the entry', () => {
    const { state, reconciler } = createReconciler({ n: 1 });

    expect(
      reconciler.tryAdoptEntry({
        serviceId: 'demo',
        stamp: { runtimeId: 'writer', counter: 1 },
        command: 'clearM',
        patch: [{ op: 'remove', path: '/m' }],
      })
    ).toBe(true);
    expect(state).toEqual({ n: 1 });
    expect(vi.mocked(logger.debug)).toHaveBeenCalledWith(
      expect.stringContaining('service=demo stamp=writer:1 path=/m command=clearM')
    );
  });
});
