import { afterEach, describe, expect, it, vi } from 'vitest';

const configWithFeatures = async (features: Record<string, boolean> | undefined) => {
  vi.stubGlobal('FEATURES', features);
  vi.resetModules();
  const { parameters, decorators } = await import('./config.ts');
  return { language: parameters.docs.source.language, decorators };
};

const featureOffCases: [string, Record<string, boolean> | undefined][] = [
  ['the feature is off', { experimentalDocgenServer: false }],
  ['no features are set', undefined],
];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('docs source parameters', () => {
  it('labels the snippet TypeScript when the docgen server produces it', async () => {
    expect((await configWithFeatures({ experimentalDocgenServer: true })).language).toBe('ts');
  });

  it.each(featureOffCases)('labels the runtime template HTML when %s', async (_name, features) => {
    expect((await configWithFeatures(features)).language).toBe('html');
  });
});

describe('docs decorators', () => {
  it('drops the runtime source decorator when the docgen server produces snippets', async () => {
    expect((await configWithFeatures({ experimentalDocgenServer: true })).decorators).toEqual([]);
  });

  it.each(featureOffCases)(
    'keeps the runtime source decorator when %s',
    async (_name, features) => {
      const { decorators } = await configWithFeatures(features);
      const { sourceDecorator } = await import('./sourceDecorator.ts');

      expect(decorators).toEqual([sourceDecorator]);
    }
  );
});
