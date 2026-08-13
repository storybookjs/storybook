import { afterEach, describe, expect, it, vi } from 'vitest';

const languageWithFeatures = async (features: Record<string, boolean> | undefined) => {
  vi.stubGlobal('FEATURES', features);
  vi.resetModules();
  const { parameters } = await import('./config.ts');
  return parameters.docs.source.language;
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('docs source parameters', () => {
  it('labels the snippet TypeScript when the docgen server produces it', async () => {
    expect(await languageWithFeatures({ experimentalDocgenServer: true })).toBe('ts');
  });

  it.each([
    ['the feature is off', { experimentalDocgenServer: false }],
    ['no features are set', undefined],
  ])('labels the runtime template HTML when %s', async (_name, features) => {
    expect(await languageWithFeatures(features)).toBe('html');
  });
});
