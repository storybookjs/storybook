import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';

import { resolve } from 'node:path';

import { mergeConfig, normalizePath } from 'vite';

import { ensureCompodocDocumentation } from './compodoc/ensure-documentation.ts';
import { angularOptionsPlugin, compodocJsonStubPlugin, features, viteFinal } from './preset.ts';
import type { StandaloneOptions } from './builders/utils/standalone-options.ts';

// The plugin's `config` hook looks up the preview file on disk before reading
// style options; stub just that lookup so the test stays hermetic.
vi.mock(import('storybook/internal/common'), async (importOriginal) => ({
  ...(await importOriginal()),
  findConfigFile: () => undefined,
}));
vi.mock('./compodoc/ensure-documentation.ts', { spy: true });
vi.mock('vite', { spy: true });
// The only mock that has to replace the module rather than spy on it: loading the real Angular
// plugin drags a full Angular toolchain into the run, and none of these tests are about it.
vi.mock('@analogjs/vite-plugin-angular', () => ({ default: (): unknown[] => [] }));

beforeEach(() => {
  vi.mocked(ensureCompodocDocumentation).mockResolvedValue(undefined);
  vi.mocked(mergeConfig).mockImplementation(
    (config: object, extra: object) => ({ ...config, ...extra }) as never
  );
  // Identity, so the workspace-absolute expectations below hold on Windows too.
  vi.mocked(normalizePath).mockImplementation((path: string) => path);
});

afterEach(() => {
  vi.mocked(ensureCompodocDocumentation).mockClear();
});

const WORKSPACE_ROOT = resolve('/workspace');

const optionsWith = (
  frameworkOptions: Record<string, unknown>,
  featureFlags: Record<string, boolean> = {}
) =>
  ({
    configDir: resolve(WORKSPACE_ROOT, '.storybook'),
    angularBuilderContext: { workspaceRoot: WORKSPACE_ROOT },
    presets: {
      apply: async (key: string, fallback?: unknown) => {
        if (key === 'framework') {
          return { options: frameworkOptions };
        }
        return key === 'features' ? featureFlags : fallback;
      },
    },
  }) as unknown as StandaloneOptions;

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
  it('generates against the resolved workspace root, tsconfig and output directory', async () => {
    await viteFinal({ root: WORKSPACE_ROOT }, optionsWith({}));

    expect(ensureCompodocDocumentation).toHaveBeenCalledWith({
      compodocArgs: ['-e', 'json', '-d', '.'],
      tsconfig: resolve(WORKSPACE_ROOT, 'tsconfig.json'),
      workspaceRoot: WORKSPACE_ROOT,
      outputDir: WORKSPACE_ROOT,
    });
  });

  it('points the run at the configured `-d` directory, which is where the reader looks', async () => {
    await viteFinal(
      { root: WORKSPACE_ROOT },
      optionsWith({ compodocArgs: ['-e', 'json', '-d', 'dist/docs'] })
    );

    expect(ensureCompodocDocumentation).toHaveBeenCalledWith(
      expect.objectContaining({ outputDir: resolve(WORKSPACE_ROOT, 'dist/docs') })
    );
  });

  it('generates nothing when the user opted out of Compodoc', async () => {
    await viteFinal({ root: WORKSPACE_ROOT }, optionsWith({ compodoc: false }));

    expect(ensureCompodocDocumentation).not.toHaveBeenCalled();
  });

  it('generates nothing when the docgen server extracts in-process instead', async () => {
    await viteFinal({ root: WORKSPACE_ROOT }, optionsWith({}, { experimentalDocgenServer: true }));

    expect(ensureCompodocDocumentation).not.toHaveBeenCalled();
  });

  it('registers the documentation.json stub only when the docgen server is on', async () => {
    const withServer = await viteFinal(
      { root: WORKSPACE_ROOT },
      optionsWith({}, { experimentalDocgenServer: true })
    );
    const withoutServer = await viteFinal({ root: WORKSPACE_ROOT }, optionsWith({}));

    const stubNames = (result: any) =>
      result.plugins
        .map((plugin: any) => plugin?.name)
        .filter((name: string) => name === 'storybook-angular-vite-compodoc-json-stub');

    expect(stubNames(withServer)).toHaveLength(1);
    expect(stubNames(withoutServer)).toHaveLength(0);
  });
});

describe('viteFinal tsconfig path resolution', () => {
  it('defaults tsconfig path resolution on, so tsconfig paths win over node_modules in dev and build alike', async () => {
    const result = (await viteFinal({ root: WORKSPACE_ROOT }, optionsWith({}))) as any;

    expect(result.resolve.tsconfigPaths).toBe(true);
  });

  it('leaves an explicit opt-out in the project vite config alone', async () => {
    const result = (await viteFinal(
      { root: WORKSPACE_ROOT, resolve: { tsconfigPaths: false } },
      optionsWith({})
    )) as any;

    expect(result.resolve.tsconfigPaths).toBe(false);
  });

  it('keeps the aliases a project already recreated by hand, so both resolve', async () => {
    const { mergeConfig: realMergeConfig } = await vi.importActual<typeof import('vite')>('vite');
    vi.mocked(mergeConfig).mockImplementation(realMergeConfig);
    const alias = [{ find: /^@app\/ui$/, replacement: resolve(WORKSPACE_ROOT, 'libs/ui/src') }];

    const result = (await viteFinal(
      { root: WORKSPACE_ROOT, resolve: { alias } },
      optionsWith({})
    )) as any;

    expect(result.resolve).toMatchObject({ alias, tsconfigPaths: true });
  });
});

describe('features', () => {
  const applyFeatures = features as (existing: unknown, options: unknown) => Promise<any>;

  it('turns the docgen server on by default', async () => {
    expect(await applyFeatures({}, {})).toMatchObject({ experimentalDocgenServer: true });
  });

  it('keeps other framework and core feature defaults', async () => {
    expect(await applyFeatures({ componentsManifest: true }, {})).toMatchObject({
      componentsManifest: true,
      experimentalDocgenServer: true,
    });
  });
});

describe('compodocJsonStubPlugin', () => {
  const CONFIG_DIR = '/workspace/.storybook';

  const runResolve = (
    source: string,
    resolvedByVite: unknown,
    importer = `${CONFIG_DIR}/preview.ts`
  ) => {
    const plugin = compodocJsonStubPlugin(CONFIG_DIR);
    const context = { resolve: vi.fn().mockResolvedValue(resolvedByVite) };
    return (plugin.resolveId as any).call(context, source, importer, {});
  };

  it('stubs the documented preview import when Compodoc never wrote the file', async () => {
    const id = await runResolve('../documentation.json', null);

    expect(id).toBe('\0storybook-angular-vite/empty-compodoc-json');

    const load = compodocJsonStubPlugin(CONFIG_DIR).load as (
      this: unknown,
      id: string
    ) => string | null;
    expect(load.call({}, id as string)).toBe('export default {};');
  });

  it('leaves a documentation.json that exists on disk alone', async () => {
    expect(await runResolve('../documentation.json', { id: '/workspace/documentation.json' })).toBe(
      null
    );
  });

  it('ignores imports of any other module', async () => {
    expect(await runResolve('./some-other.json', null)).toBe(null);
  });

  // Only the import `storybook init` wrote into the preview is stood in for; the project's own
  // `documentation.json` is a real dependency and a missing one has to fail.
  it("leaves a documentation.json imported from the user's own code alone", async () => {
    expect(await runResolve('./documentation.json', null, '/workspace/src/app/docs.ts')).toBe(null);
  });

  it('leaves an import with no importer alone', async () => {
    const plugin = compodocJsonStubPlugin(CONFIG_DIR);
    const context = { resolve: vi.fn().mockResolvedValue(null) };

    expect(
      await (plugin.resolveId as any).call(context, '../documentation.json', undefined, {})
    ).toBe(null);
  });
});

describe('viteFinal props-table wiring', () => {
  const definedMode = async (
    frameworkOptions: Record<string, unknown>,
    featureFlags: Record<string, boolean> = {}
  ) => {
    const result = (await viteFinal(
      { root: WORKSPACE_ROOT },
      optionsWith(frameworkOptions, featureFlags)
    )) as any;
    return JSON.parse(result.define.STORYBOOK_ANGULAR_OPTIONS).propsTable;
  };

  it('hands the preview the resolved mode, which is how the flag-off path reads it', async () => {
    await expect(definedMode({})).resolves.toBe('api');
    await expect(definedMode({ propsTable: 'all' })).resolves.toBe('all');
    await expect(definedMode({}, { angularFilterNonInputControls: true })).resolves.toBe('inputs');
  });

  it('warns from here, because the docgen preset never runs with the feature off', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    try {
      await viteFinal({ root: WORKSPACE_ROOT }, optionsWith({ propsTable: 'api' }));

      expect(warn.mock.calls.map(([message]) => String(message)).join('\n')).toContain(
        'experimentalDocgenServer'
      );
    } finally {
      warn.mockRestore();
    }
  });
});
