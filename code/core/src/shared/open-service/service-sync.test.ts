import { describe, expect, it } from 'vitest';

import { applyStatePatch } from './service-sync.ts';

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
