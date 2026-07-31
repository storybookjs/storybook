import { describe, expect, it, vi } from 'vitest';

import { resolve } from 'node:path';

import { normalizePath } from 'vite';

import { angularOptionsPlugin } from './preset.ts';
import type { StandaloneOptions } from './builders/utils/standalone-options.ts';

// The plugin's `config` hook looks up the preview file on disk before reading
// style options; stub just that lookup so the test stays hermetic.
vi.mock(import('storybook/internal/common'), async (importOriginal) => ({
  ...(await importOriginal()),
  findConfigFile: () => undefined,
}));

const WORKSPACE_ROOT = '/workspace';

function runConfig(stylePreprocessorOptions: Record<string, unknown> | undefined) {
  const options = {
    configDir: '/workspace/.storybook',
    angularBuilderContext: { workspaceRoot: WORKSPACE_ROOT } as any,
    angularBuilderOptions: stylePreprocessorOptions ? { stylePreprocessorOptions } : {},
  } as unknown as StandaloneOptions;

  const plugin = angularOptionsPlugin(options, { normalizePath, zoneless: true });
  // `config` is defined as a plain method above, so invoke it directly.
  return (plugin.config as (userConfig: unknown) => any)({ root: WORKSPACE_ROOT });
}

describe('angularOptionsPlugin style preprocessor paths', () => {
  it('resolves `includePaths` (angular.json spelling) to workspace-absolute SCSS load paths', () => {
    const result = runConfig({ includePaths: ['src/styles', 'libs/theme'] });

    expect(result.css.preprocessorOptions.scss.loadPaths).toEqual([
      resolve(WORKSPACE_ROOT, 'src/styles'),
      resolve(WORKSPACE_ROOT, 'libs/theme'),
    ]);
  });

  it('accepts `loadPaths` as a dart-sass/Vite-spelling alias', () => {
    const result = runConfig({ loadPaths: ['src/styles'] });

    expect(result.css.preprocessorOptions.scss.loadPaths).toEqual([
      resolve(WORKSPACE_ROOT, 'src/styles'),
    ]);
  });

  it('prefers `includePaths` over `loadPaths` when both are present', () => {
    const result = runConfig({ includePaths: ['a'], loadPaths: ['b'] });

    expect(result.css.preprocessorOptions.scss.loadPaths).toEqual([resolve(WORKSPACE_ROOT, 'a')]);
  });

  it('forwards `sass` options alongside the resolved load paths', () => {
    const result = runConfig({
      includePaths: ['src/styles'],
      sass: { silenceDeprecations: ['import'] },
    });

    expect(result.css.preprocessorOptions.scss).toMatchObject({
      silenceDeprecations: ['import'],
      loadPaths: [resolve(WORKSPACE_ROOT, 'src/styles')],
    });
  });

  it('returns nothing when no style preprocessor paths are configured', () => {
    expect(runConfig(undefined)).toBeUndefined();
    expect(runConfig({})).toBeUndefined();
  });
});
