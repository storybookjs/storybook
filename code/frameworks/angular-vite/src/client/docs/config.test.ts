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
    vi.resetModules();
  });

  it('registers the source decorator by default', async () => {
    await expect(loadDecorators()).resolves.toHaveLength(1);
  });

  // With the server-side docs path on, `story-docs` emits the snippet instead. Leaving this
  // decorator registered would have two generators emitting for the same story.
  it('drops the source decorator when the server-side docs path is on', async () => {
    vi.stubGlobal('FEATURES', { experimentalDocgenServer: true });

    await expect(loadDecorators()).resolves.toEqual([]);
  });
});
