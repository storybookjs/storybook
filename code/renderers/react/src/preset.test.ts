import { describe, expect, it } from 'vitest';

import { features, optimizeViteDeps } from './preset.ts';

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

  it('includes react', () => {
    // The vitest project-annotations setup file imports this renderer's entry previews through a
    // virtual module, and those chunks import React by the bare specifier. In the observed
    // failure (react 19.3.1, vite 7.3.7, vitest 5.0.5, chromium browser mode) the dependency
    // scan had not registered plain `react`, so the browser loaded react's CJS index.js raw and
    // module linking failed with "The requested module 'react/index.js' does not provide an
    // export named 'default'".
    // If this test fails, add 'react' back to the optimizeViteDeps array in preset.ts.
    expect(optimizeViteDeps).toContain('react');
  });

  it('includes react/jsx-runtime', () => {
    // Plugins such as vite-plugin-svgr emit `react/jsx-runtime` imports while transforming non-JS
    // files. The dependency scan does not run those transforms, so the import is only found
    // mid-run and a second copy of React gets loaded.
    // If this test fails, add 'react/jsx-runtime' back to the optimizeViteDeps array in preset.ts.
    expect(optimizeViteDeps).toContain('react/jsx-runtime');
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
