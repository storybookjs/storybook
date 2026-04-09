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

    clearVitePlusCache();
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
    vi.doMock('vite-plus/versions', () => {
      throw new Error("Cannot find module 'vite-plus/versions'");
    });

    clearVitePlusCache();
    const { getVitePlusVersions: fn } = await import('./vite-plus-versions.ts');
    clearVitePlusCache();

    const result = await fn();

    expect(result).toBeNull();

    vi.doUnmock('vite-plus/versions');
  });

  it('caches results across calls', async () => {
    vi.doMock('vite-plus/versions', () => ({
      versions: { vite: '6.1.0', vitest: '3.2.0' },
    }));

    clearVitePlusCache();
    const { getVitePlusVersions: fn } = await import('./vite-plus-versions.ts');
    clearVitePlusCache();

    const result1 = await fn();
    const result2 = await fn();

    expect(result1).toEqual(result2);
    // Same cached reference
    expect(result1).toBe(result2);

    vi.doUnmock('vite-plus/versions');
  });

  it('clearVitePlusCache resets the cache allowing new values', async () => {
    vi.doMock('vite-plus/versions', () => ({
      versions: { vite: '6.1.0', vitest: '3.2.0' },
    }));

    clearVitePlusCache();
    const mod = await import('./vite-plus-versions.ts');
    mod.clearVitePlusCache();

    const result1 = await mod.getVitePlusVersions();
    expect(result1?.vite).toBe('6.1.0');

    vi.doUnmock('vite-plus/versions');

    // After clearing, mock with different values
    vi.doMock('vite-plus/versions', () => ({
      versions: { vite: '7.0.0', vitest: '4.0.0' },
    }));

    mod.clearVitePlusCache();
    const { getVitePlusVersions: fn2 } = await import('./vite-plus-versions.ts');
    mod.clearVitePlusCache();

    const result2 = await fn2();
    expect(result2?.vite).toBe('7.0.0');

    vi.doUnmock('vite-plus/versions');
  });
});
