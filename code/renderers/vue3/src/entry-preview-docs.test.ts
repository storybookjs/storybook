import { afterEach, describe, expect, it, vi } from 'vitest';

const decoratorsWith = async (features: Record<string, boolean> | undefined, docgen: unknown) => {
  vi.stubGlobal('FEATURES', features);
  vi.stubGlobal('FRAMEWORK_OPTIONS', { docgen });
  vi.resetModules();
  return (await import('./entry-preview-docs.ts')).decorators;
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('docs decorators', () => {
  it.each([
    ['string option', 'vue-component-meta'],
    ['object option', { plugin: 'vue-component-meta' }],
  ])('drops the runtime source decorator for the %s', async (_name, docgen) => {
    expect(await decoratorsWith({ experimentalDocgenServer: true }, docgen)).toEqual([]);
  });

  it.each([
    ['the docgen server is off', { experimentalDocgenServer: false }, 'vue-component-meta'],
    ['Vue Component Meta is off', { experimentalDocgenServer: true }, 'vue-docgen-api'],
    ['no options are set', undefined, undefined],
  ])('keeps the runtime source decorator when %s', async (_name, features, docgen) => {
    expect(await decoratorsWith(features, docgen)).toHaveLength(1);
  });
});
