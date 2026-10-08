import { describe, expect, it } from 'vitest';

import { features, optimizeViteDeps, previewAnnotations } from './preset.ts';

describe('optimizeViteDeps', () => {
  it('includes react-dom/client', () => {
    expect(optimizeViteDeps).toContain('react-dom/client');
  });

  it('includes react-dom/test-utils', () => {
    // react-dom/test-utils is dynamically imported via `await import('react-dom/test-utils')`
    // in act-compat.ts. Vite's static analyzer does not pre-bundle dynamic imports,
    // so it must be listed explicitly in optimizeViteDeps.
    // If this test fails, add 'react-dom/test-utils' back to the optimizeViteDeps array in preset.ts.
    expect(optimizeViteDeps).toContain('react-dom/test-utils');
  });
});

describe('features', () => {
  const applyFeatures = features as (existing: unknown) => Promise<Record<string, unknown>>;

  it('turns component manifests on by default', async () => {
    expect(await applyFeatures({})).toMatchObject({ componentsManifest: true });
  });

  it('keeps other feature defaults from earlier presets', async () => {
    expect(await applyFeatures({ controls: true })).toMatchObject({
      controls: true,
      componentsManifest: true,
    });
  });
});

describe('previewAnnotations', () => {
  it('does not throw when the docs preset returns undefined', async () => {
    if (typeof previewAnnotations !== 'function') {
      throw new Error('expected previewAnnotations to be a function');
    }

    const options = {
      presets: {
        apply: async (key: string) => {
          if (key === 'docs') {
            return undefined;
          }
          if (key === 'features') {
            return {};
          }
          return {};
        },
      },
    };

    await expect(previewAnnotations([], options as never)).resolves.toEqual(expect.any(Array));
  });
});
