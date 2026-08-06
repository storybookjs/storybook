import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The flag is read once at module evaluation, so each case needs a fresh module registry.
const loadDecorators = async () => {
  vi.resetModules();
  return (await import('./config.ts')).decorators;
};

describe('angular docs decorators', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registers the source decorator by default', async () => {
    await expect(loadDecorators()).resolves.toHaveLength(1);
  });

  it('drops the source decorator when the server-side docs path is on', async () => {
    vi.stubGlobal('FEATURES', { experimentalDocgenServer: true });

    await expect(loadDecorators()).resolves.toEqual([]);
  });
});
