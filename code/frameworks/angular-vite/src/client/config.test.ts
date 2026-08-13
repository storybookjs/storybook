import { afterEach, describe, expect, it, vi } from 'vitest';

const docsParametersWithFeatures = async (features: Record<string, boolean> | undefined) => {
  vi.stubGlobal('FEATURES', features);
  vi.resetModules();
  const { parameters } = await import('./config.ts');
  return parameters.docs;
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('preview parameters', () => {
  it('does not register the Compodoc extractors when the docgen server is on', async () => {
    const docs = await docsParametersWithFeatures({ experimentalDocgenServer: true });

    expect(docs).not.toHaveProperty('extractArgTypes');
    expect(docs).not.toHaveProperty('extractComponentDescription');
    expect(docs.story).toEqual({ inline: true });
  });

  it.each([
    ['the feature is off', { experimentalDocgenServer: false }],
    ['no features are set', undefined],
  ])('registers the Compodoc extractors when %s', async (_name, features) => {
    const docs = await docsParametersWithFeatures(features);

    expect(docs.extractArgTypes).toBeInstanceOf(Function);
    expect(docs.extractComponentDescription).toBeInstanceOf(Function);
  });
});
