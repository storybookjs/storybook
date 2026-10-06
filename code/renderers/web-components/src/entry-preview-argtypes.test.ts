// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';

const loadParameters = async (): Promise<
  (typeof import('./entry-preview-argtypes'))['parameters']
> => {
  const { parameters } = await import('./entry-preview-argtypes');
  return parameters;
};

afterEach((): void => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

it('omits runtime docs extractors when docgen server is enabled', async (): Promise<void> => {
  vi.resetModules();
  vi.stubGlobal('FEATURES', { experimentalDocgenServer: true });

  await expect(loadParameters()).resolves.toEqual({});
});

it('keeps runtime docs extractors when docgen server is not enabled', async (): Promise<void> => {
  vi.resetModules();

  const parameters = await loadParameters();

  expect(parameters).toMatchInlineSnapshot(`
      {
        "docs": {
          "extractArgTypes": [Function],
          "extractComponentDescription": [Function],
        },
      }
    `);
});
