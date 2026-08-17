import { afterEach, describe, expect, it, vi } from 'vitest';

const decoratorsWith = async (features: Record<string, boolean> | undefined) => {
  vi.stubGlobal('FEATURES', features);
  vi.resetModules();
  return (await import('./entry-preview-docs.ts')).decorators;
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('docs decorators', () => {
  it('drops the runtime source decorator when the docgen server is enabled', async () => {
    expect(await decoratorsWith({ experimentalDocgenServer: true })).toEqual([]);
  });

  it.each([
    ['the feature is off', { experimentalDocgenServer: false }],
    ['no features are set', undefined],
  ])('keeps the runtime source decorator when %s', async (_name, features) => {
    expect(await decoratorsWith(features)).toHaveLength(1);
  });
});
