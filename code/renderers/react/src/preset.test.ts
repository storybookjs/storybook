import { describe, expect, it, vi } from 'vitest';

vi.mock('storybook/internal/common', () => ({
  getProjectRoot: vi.fn(),
}));

vi.mock('../../../core/src/shared/utils/module', () => ({
  resolvePackageDir: vi.fn(),
}));

vi.mock('./componentManifest/reactDocgen/extractReactDocgenInfo', () => ({
  extractArgTypesFromDocgen: vi.fn(),
}));

vi.mock('./componentManifest/reactDocgen/extractReactTypescriptDocgenInfo', () => ({
  extractArgTypesFromDocgenTypescript: vi.fn(),
}));

vi.mock('./componentManifest/generator', () => ({
  manifests: vi.fn(),
}));

vi.mock('./enrichCsf', () => ({
  enrichCsf: vi.fn(),
}));

import { optimizeViteDeps } from './preset';

describe('optimizeViteDeps', () => {
  it('includes react-dom/test-utils', () => {
    // react-dom/test-utils is dynamically imported via `await import('react-dom/test-utils')`
    // in act-compat.ts. Vite's static analyzer does not pre-bundle dynamic imports,
    // so it must be listed explicitly in optimizeViteDeps.
    // If this test fails, add 'react-dom/test-utils' back to the optimizeViteDeps array in preset.ts.
    expect(optimizeViteDeps).toContain('react-dom/test-utils');
  });

  it('includes react/jsx-dev-runtime', () => {
    // React stories and tests can import the development JSX runtime on first execution.
    // If Vite optimizes it lazily during the run, hooks can break until the cache is warm.
    expect(optimizeViteDeps).toContain('react/jsx-dev-runtime');
  });
});
