import { describe, expect, it } from 'vitest';

import { optimizeViteDeps, previewAnnotations } from './preset.ts';

describe('optimizeViteDeps', () => {
  it('includes react-dom/test-utils', () => {
    // react-dom/test-utils is dynamically imported via `await import('react-dom/test-utils')`
    // in act-compat.ts. Vite's static analyzer does not pre-bundle dynamic imports,
    // so it must be listed explicitly in optimizeViteDeps.
    // If this test fails, add 'react-dom/test-utils' back to the optimizeViteDeps array in preset.ts.
    expect(optimizeViteDeps).toContain('react-dom/test-utils');
  });
});

describe('previewAnnotations', () => {
  it('does not throw when the docs preset returns undefined', async () => {
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
