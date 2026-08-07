import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { vol } from 'memfs';
import { mergeConfig, normalizePath } from 'vite';

import { runCompodoc } from './builders/utils/run-compodoc.ts';
import { angularOptionsPlugin, viteFinal } from './preset.ts';
import type { StandaloneOptions } from './builders/utils/standalone-options.ts';

// The plugin's `config` hook looks up the preview file on disk before reading
// style options; stub just that lookup so the test stays hermetic.
vi.mock(import('storybook/internal/common'), async (importOriginal) => ({
  ...(await importOriginal()),
  findConfigFile: () => undefined,
}));
vi.mock('node:fs', { spy: true });
vi.mock('./builders/utils/run-compodoc.ts', { spy: true });
vi.mock('vite', { spy: true });
// The only mock that has to replace the module rather than spy on it: loading the real Angular
// plugin drags a full Angular toolchain into the run, and none of these tests are about it.
vi.mock('@analogjs/vite-plugin-angular', () => ({ default: (): unknown[] => [] }));

beforeEach(async () => {
  vol.reset();
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  vi.mocked(existsSync).mockImplementation(memfs.fs.existsSync as typeof existsSync);
  vi.mocked(runCompodoc).mockResolvedValue(undefined);
  vi.mocked(mergeConfig).mockImplementation(
    (config: object, extra: object) => ({ ...config, ...extra }) as never
  );
  // Identity, so the workspace-absolute expectations below hold on Windows too.
  vi.mocked(normalizePath).mockImplementation((path: string) => path);
});

afterEach(() => {
  vi.mocked(runCompodoc).mockClear();
});

const WORKSPACE_ROOT = resolve('/workspace');

function runConfig(stylePreprocessorOptions: Record<string, unknown> | undefined) {
  const options = {
    configDir: resolve(WORKSPACE_ROOT, '.storybook'),
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

describe('viteFinal Compodoc generation', () => {
  const optionsWith = (frameworkOptions: Record<string, unknown>) =>
    ({
      configDir: resolve(WORKSPACE_ROOT, '.storybook'),
      angularBuilderContext: { workspaceRoot: WORKSPACE_ROOT },
      presets: {
        apply: async (key: string, fallback?: unknown) =>
          key === 'framework' ? { options: frameworkOptions } : fallback,
      },
    }) as unknown as StandaloneOptions;

  it('generates against the resolved workspace root and tsconfig', async () => {
    await viteFinal({ root: WORKSPACE_ROOT }, optionsWith({}));

    expect(runCompodoc).toHaveBeenCalledWith({
      compodocArgs: ['-e', 'json', '-d', '.'],
      tsconfig: resolve(WORKSPACE_ROOT, 'tsconfig.json'),
      workspaceRoot: WORKSPACE_ROOT,
    });
  });

  it('skips generation when documentation.json already sits in the configured `-d` directory', async () => {
    // Reading honours `-d`, so probing the workspace root instead regenerates on every cold start
    // for any project that redirects Compodoc's output.
    vol.fromNestedJSON({ [resolve(WORKSPACE_ROOT, 'dist/docs/documentation.json')]: '{}' });

    await viteFinal(
      { root: WORKSPACE_ROOT },
      optionsWith({ compodocArgs: ['-e', 'json', '-d', 'dist/docs'] })
    );

    expect(runCompodoc).not.toHaveBeenCalled();
  });

  it('honours the `--output=dir` spelling as well as the separate-value one', async () => {
    vol.fromNestedJSON({ [resolve(WORKSPACE_ROOT, 'dist/docs/documentation.json')]: '{}' });

    await viteFinal(
      { root: WORKSPACE_ROOT },
      optionsWith({ compodocArgs: ['-e', 'json', '--output=dist/docs'] })
    );

    expect(runCompodoc).not.toHaveBeenCalled();
  });

  it('generates nothing when the user opted out of Compodoc', async () => {
    await viteFinal({ root: WORKSPACE_ROOT }, optionsWith({ compodoc: false }));

    expect(runCompodoc).not.toHaveBeenCalled();
  });
});
