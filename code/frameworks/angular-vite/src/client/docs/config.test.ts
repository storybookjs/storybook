import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The flag is read once at module evaluation, so each case needs a fresh module registry.
const loadConfig = async () => {
  vi.resetModules();
  return import('./config.ts');
};

const loadDecorators = async () => (await loadConfig()).decorators;

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

  // `dynamic` makes the Source block render the snippet unconditionally. With no decorator
  // guaranteeing one, that shows an empty code block for every story the server provider does not
  // cover; `auto` is what lets the block fall back to the story's own source.
  it.each([
    [undefined, 'dynamic'],
    [{ experimentalDocgenServer: true }, 'auto'],
  ])('uses the %s source type', async (features, expected) => {
    if (features) {
      vi.stubGlobal('FEATURES', features);
    }

    await expect((await loadConfig()).parameters.docs.source.type).toBe(expected);
  });
});
