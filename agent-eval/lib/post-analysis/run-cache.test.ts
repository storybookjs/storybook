import { vol } from 'memfs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { isCurrentCacheEntry, readCacheEntry, writeCacheEntry } from './run-cache.ts';

vi.mock('node:fs', async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  return { ...memfs.fs, default: memfs.fs };
});

afterEach(() => {
  vol.reset();
});

describe('run cache', () => {
  it('round-trips an entry with its metrics version', () => {
    vol.fromJSON({ '/run/x.txt': '' });
    writeCacheEntry('/run', { a: 1 }, 6);
    const entry = readCacheEntry('/run');
    expect(entry).toMatchObject({ metricsVersion: 6, output: { a: 1 } });
    expect(isCurrentCacheEntry(entry, 6)).toBe(true);
  });

  it('rejects a version mismatch and an unstamped legacy entry', () => {
    vol.fromJSON({
      '/run/post-analysis-meta.json': JSON.stringify({ analyzedAt: 'x', output: { a: 1 } }),
    });
    const entry = readCacheEntry('/run');
    expect(isCurrentCacheEntry(entry, 6)).toBe(false);
  });

  it('matches when both versions are undefined', () => {
    vol.fromJSON({ '/run/x.txt': '' });
    writeCacheEntry('/run', { a: 1 }, undefined);
    expect(isCurrentCacheEntry(readCacheEntry('/run'), undefined)).toBe(true);
  });

  it('returns null for a missing file', () => {
    expect(readCacheEntry('/nope')).toBeNull();
  });
});
