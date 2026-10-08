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

  it('includes react/jsx-runtime', () => {
    // Vite plugins such as vite-plugin-svgr emit `react/jsx-runtime` imports while transforming
    // non-JS files (e.g. `.svg`). The dependency scan does not run those transforms, so the import
    // is only discovered mid-run, which re-optimizes React and loads a second copy of it.
    // @vitejs/plugin-react includes it for regular Vite apps, but frameworks like nextjs-vite do not
    // use that plugin. If this test fails, add 'react/jsx-runtime' back to optimizeViteDeps.
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
