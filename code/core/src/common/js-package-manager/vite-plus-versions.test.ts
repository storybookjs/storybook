import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearVitePlusCache, getVitePlusVersions } from './vite-plus-versions.ts';

vi.mock('storybook/internal/node-logger', () => ({
  logger: { debug: vi.fn() },
}));

describe('getVitePlusVersions', () => {
  afterEach(() => {
    clearVitePlusCache();
    vi.restoreAllMocks();
  });

  it('returns versions when vite-plus/versions is importable', async () => {
    vi.doMock('vite-plus/versions', () => ({
      versions: { vite: '6.1.0', vitest: '3.2.0', rolldown: '0.5.0' },
    }));

    // Clear cache so fresh import is attempted
    clearVitePlusCache();
    // Re-import to pick up the doMock
    const { getVitePlusVersions: fn } = await import('./vite-plus-versions.ts');
    clearVitePlusCache();

    const result = await fn();

    expect(result).toEqual(
      expect.objectContaining({
        vite: '6.1.0',
        vitest: '3.2.0',
      })
    );

    vi.doUnmock('vite-plus/versions');
  });

  it('returns null when vite-plus/versions is not available', async () => {
    // By default, vite-plus/versions is not installed in this repo, so import will fail
    const result = await getVitePlusVersions();

    expect(result).toBeNull();
  });

  it('caches results across calls', async () => {
    const result1 = await getVitePlusVersions();
    const result2 = await getVitePlusVersions();

    expect(result1).toBeNull();
    expect(result2).toBeNull();
    // Both should be the same cached reference
    expect(result1).toBe(result2);
  });

  it('clearVitePlusCache resets the cache', async () => {
    const result1 = await getVitePlusVersions();
    expect(result1).toBeNull();

    // Mock vite-plus/versions after first call
    vi.doMock('vite-plus/versions', () => ({
      versions: { vite: '6.1.0', vitest: '3.2.0' },
    }));

    // Without clearing, should still return cached null
    const result2 = await getVitePlusVersions();
    expect(result2).toBeNull();

    // After clearing cache, should pick up the mock
    clearVitePlusCache();
    const { getVitePlusVersions: fn } = await import('./vite-plus-versions.ts');
    clearVitePlusCache();

    const result3 = await fn();
    expect(result3).toEqual(
      expect.objectContaining({
        vite: '6.1.0',
        vitest: '3.2.0',
      })
    );

    vi.doUnmock('vite-plus/versions');
  });
});
