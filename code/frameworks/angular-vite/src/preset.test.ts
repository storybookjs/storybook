import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { findConfigFile } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import {
  AngularMissingStylePreprocessorError,
  AngularUnresolvedStyleError,
} from 'storybook/internal/server-errors';

import { existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fs as memfs, vol } from 'memfs';
import { mergeConfig, normalizePath } from 'vite';

import { ensureCompodocDocumentation } from './compodoc/ensure-documentation.ts';
import {
  angularOptionsPlugin,
  compodocJsonStubPlugin,
  experimental_docgenProvider,
  experimental_manifests,
  experimental_storyDocsProvider,
  features,
  stylePreprocessorCheckPlugin,
  viteFinal,
} from './preset.ts';
import type { StandaloneOptions } from './builders/utils/standalone-options.ts';

// The plugin's `config` hook looks up the preview file on disk before reading
// style options; stub just that lookup so the test stays hermetic.
vi.mock(import('storybook/internal/common'), async (importOriginal) => ({
  ...(await importOriginal()),
  findConfigFile: vi.fn(),
}));
vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('./compodoc/ensure-documentation.ts', { spy: true });
vi.mock('vite', { spy: true });
// Spy-only mock: `styles` resolution stats candidate files, and only that call is redirected to a
// memfs volume, so everything else in the preset keeps reading the real filesystem.
vi.mock('node:fs', { spy: true });
// Spy-only as well: the preprocessor check is the one place that asks node for a package, and the
// tests below need to say which packages a user's project has without installing any of them.
vi.mock('node:module', { spy: true });
// The only mock that has to replace the module rather than spy on it: loading the real Angular
// plugin drags a full Angular toolchain into the run, and none of these tests are about it.
vi.mock('@analogjs/vite-plugin-angular', () => ({ default: (): unknown[] => [] }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(findConfigFile).mockReturnValue(undefined);
  vi.mocked(ensureCompodocDocumentation).mockResolvedValue(undefined);
  vi.mocked(logger.warn).mockImplementation(() => {});
  vi.mocked(mergeConfig).mockImplementation(
    (config: object, extra: object) => ({ ...config, ...extra }) as never
  );
  // Identity, so the workspace-absolute expectations below hold on Windows too.
  vi.mocked(normalizePath).mockImplementation((path: string) => path);
});

const WORKSPACE_ROOT = resolve('/workspace');

// Storybook discovers these by reading the preset module's exports, so dropping a re-export is
// type-valid and silent: docgen extraction simply stops running, and the failure only surfaces as
// an empty static build several minutes into a sandbox job.
describe('docgen preset entry points', () => {
  it.each([
    ['experimental_docgenProvider', experimental_docgenProvider],
    ['experimental_manifests', experimental_manifests],
    ['experimental_storyDocsProvider', experimental_storyDocsProvider],
  ])('re-exports %s', (_name, entryPoint) => {
    expect(entryPoint).toBeTypeOf('function');
  });
});

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

  it('forwards `sass` options that come without any load paths', () => {
    const result = runConfig({ sass: { silenceDeprecations: ['import'] } });

    expect(result.css.preprocessorOptions.scss).toEqual({ silenceDeprecations: ['import'] });
  });

  it('returns nothing when no style preprocessor paths are configured', () => {
    expect(runConfig(undefined)).toBeUndefined();
    expect(runConfig({})).toBeUndefined();
  });
});

describe('stylePreprocessorCheckPlugin', () => {
  // Vite's fallback directory. Computed the same way the plugin computes it, because a package
  // only Vite's own tree can reach is one Vite still loads.
  const VITE_DIR = dirname(fileURLToPath(import.meta.resolve('vite')));

  type StyleCheckHook = {
    filter: { id: { include: RegExp; exclude: RegExp } };
    handler: (code: string, id: string) => unknown;
  };

  const runTransform = (hook: StyleCheckHook, id: string) =>
    hook.filter.id.include.test(id) && !hook.filter.id.exclude.test(id)
      ? hook.handler('', id)
      : undefined;

  function transformStyle(
    id: string,
    {
      packages = [],
      installedIn = WORKSPACE_ROOT,
      entryPointResolves = packages,
      notExported = [],
      bypassFilter = false,
    }: {
      packages?: string[];
      installedIn?: string;
      entryPointResolves?: string[];
      notExported?: string[];
      bypassFilter?: boolean;
    } = {}
  ) {
    const present = new Set(
      packages.map((pkg) => resolve(installedIn, 'node_modules', pkg, 'package.json'))
    );
    vi.mocked(existsSync).mockImplementation((path) => present.has(String(path)));
    // Node resolves upwards, so the mock answers per directory rather than globally: asking from
    // somewhere that cannot see `installedIn` has to fail, or a test cannot tell the two search
    // directories apart.
    vi.mocked(createRequire).mockImplementation((from) => {
      const askedFrom = dirname(String(from));
      const prefix = installedIn.endsWith(sep) ? installedIn : installedIn + sep;
      const canSee = askedFrom === installedIn || askedFrom.startsWith(prefix);
      return {
        resolve: (request: string) => {
          if (canSee && entryPointResolves.includes(request)) {
            return request;
          }
          const refusedEntryPoint = canSee && notExported.includes(request);
          throw Object.assign(
            new Error(
              refusedEntryPoint
                ? `No "exports" main defined in '${request}'`
                : `Cannot find module '${request}'`
            ),
            { code: refusedEntryPoint ? 'ERR_PACKAGE_PATH_NOT_EXPORTED' : 'MODULE_NOT_FOUND' }
          );
        },
      } as unknown as NodeJS.Require;
    });

    const plugin = stylePreprocessorCheckPlugin();
    (plugin.configResolved as (config: unknown) => void)({ root: WORKSPACE_ROOT });
    const hook = plugin.transform as StyleCheckHook;
    return () => (bypassFilter ? hook.handler('', id) : runTransform(hook, id));
  }

  afterEach(() => {
    vi.mocked(createRequire).mockRestore();
    vi.mocked(existsSync).mockRestore();
  });

  // Vite's own message names `sass-embedded`, because `loadSassPackage` tries that first and
  // rethrows *its* error, so the user installs a package that was never the missing one.
  it('names `sass` when a project with no sass at all compiles SCSS', () => {
    const compile = transformStyle(resolve(WORKSPACE_ROOT, 'src/button.scss'));

    expect(compile).toThrow(AngularMissingStylePreprocessorError);
    expect(compile).toThrow(/npm install --save-dev sass/);
  });

  it('offers `sass-embedded` as the alternative rather than the fix', () => {
    const compile = transformStyle(resolve(WORKSPACE_ROOT, 'src/button.scss'));

    expect(compile).toThrow(/'sass-embedded' works as well/);
  });

  it.each(['sass', 'sass-embedded'])('compiles SCSS when the project has %s', (pkg) => {
    expect(
      transformStyle(resolve(WORKSPACE_ROOT, 'src/button.scss'), { packages: [pkg] })
    ).not.toThrow();
  });

  it('checks `.sass` and `.less` against their own packages', () => {
    expect(
      transformStyle(resolve(WORKSPACE_ROOT, 'src/button.sass'), { packages: ['sass'] })
    ).not.toThrow();
    expect(
      transformStyle(resolve(WORKSPACE_ROOT, 'src/button.less'), { packages: ['sass'] })
    ).toThrow(/npm install --save-dev less/);
    expect(
      transformStyle(resolve(WORKSPACE_ROOT, 'src/button.less'), { packages: ['less'] })
    ).not.toThrow();
  });

  // Vite appends `?used`, `?inline` and friends before a stylesheet reaches `transform`.
  it('checks a stylesheet that arrives with a Vite query suffix', () => {
    const compile = transformStyle(`${resolve(WORKSPACE_ROOT, 'src/button.scss')}?used`);

    expect(compile).toThrow(AngularMissingStylePreprocessorError);
    expect(compile).toThrow(/button\.scss'/);
    expect(compile).not.toThrow(/\?used/);
  });

  // Vite's css plugins exclude these queries from their transform, so the file is read as an asset
  // and no preprocessor runs. Throwing here would refuse a project that compiles.
  it.each(['raw', 'url', 'worker', 'sharedworker'])(
    'leaves a stylesheet requested as `?%s` alone',
    (query) => {
      expect(
        transformStyle(`${resolve(WORKSPACE_ROOT, 'src/button.scss')}?${query}`)
      ).not.toThrow();
    }
  );

  // A filter is an optimization Vite is free to skip, so the handler asks the same question itself.
  it('leaves a `?raw` stylesheet alone even when the filter is skipped', () => {
    expect(
      transformStyle(`${resolve(WORKSPACE_ROOT, 'src/button.scss')}?raw`, { bypassFilter: true })
    ).not.toThrow();
  });

  it('leaves files that need no preprocessor alone', () => {
    expect(transformStyle(resolve(WORKSPACE_ROOT, 'src/button.css'))).not.toThrow();
    expect(transformStyle(resolve(WORKSPACE_ROOT, 'src/button.ts'))).not.toThrow();
  });

  // A hoisted `sass` sits above the Vite root, which is exactly where Vite finds it and where this
  // check has to look too - anything narrower reports a working project as broken.
  it('searches upwards from the Vite root, not only inside it', () => {
    expect(
      transformStyle(resolve(WORKSPACE_ROOT, 'src/button.scss'), {
        packages: ['sass'],
        installedIn: dirname(WORKSPACE_ROOT),
      })
    ).not.toThrow();
  });

  // Every case below is a project Vite compiles. The check aborts the build, so reporting any of
  // them as missing turns a working setup into a hard failure.
  //
  // Vite resolves preprocessors with its own conditions, so a package whose `exports` map offers
  // only `import` loads for Vite while `createRequire().resolve` throws ERR_PACKAGE_PATH_NOT_EXPORTED.
  it('accepts a preprocessor whose `exports` map has no `require` condition', () => {
    expect(
      transformStyle(resolve(WORKSPACE_ROOT, 'src/button.scss'), {
        packages: ['sass'],
        entryPointResolves: [],
      })
    ).not.toThrow();
  });

  // `loadPreprocessorPath` falls back to Vite's own directory when the root cannot see the package,
  // which is how a linked or monorepo checkout compiles SCSS with nothing installed near the root.
  it('accepts a copy that only Vite`s own directory can reach', () => {
    expect(
      transformStyle(resolve(WORKSPACE_ROOT, 'src/button.scss'), {
        packages: ['sass'],
        installedIn: VITE_DIR,
      })
    ).not.toThrow();
  });

  // Yarn PnP has no `node_modules` directories to walk, so the resolver is the only thing that can
  // answer there.
  it('accepts a Yarn PnP install, where there is no `node_modules` to walk', () => {
    expect(
      transformStyle(resolve(WORKSPACE_ROOT, 'src/button.scss'), {
        packages: [],
        entryPointResolves: ['sass'],
      })
    ).not.toThrow();
  });

  // The two cases above combined, and the one layout no `node_modules` walk can rescue: under PnP
  // the resolver is the only witness, so it has to tell "no such package" apart from "the package is
  // here and its entry point is not exported to `require`". Only the first is a missing install.
  it('accepts a Yarn PnP install whose `exports` map has no `require` condition', () => {
    expect(
      transformStyle(resolve(WORKSPACE_ROOT, 'src/button.scss'), {
        packages: [],
        entryPointResolves: [],
        notExported: ['sass'],
      })
    ).not.toThrow();
  });

  // `pre` puts this hook ahead of the whole module graph, so an unfiltered handler would be called
  // once per module - overwhelmingly for files that can never need a preprocessor - to answer a
  // question about stylesheets. The filter is what keeps it off that path, and it earns its place
  // only if it covers every stylesheet and nothing else.
  it('is asked about stylesheets and nothing else', () => {
    const { filter } = stylePreprocessorCheckPlugin().transform as StyleCheckHook;
    const matching = (ids: string[]) =>
      ids.filter((id) => filter.id.include.test(id) && !filter.id.exclude.test(id));

    expect(
      matching([
        'src/button.scss',
        'src/button.sass',
        'src/button.less',
        // Vite appends `?used`, `?inline` and friends before a stylesheet reaches `transform`.
        'src/button.scss?used',
      ])
    ).toHaveLength(4);
    expect(
      matching([
        'src/app.ts',
        'src/app.html',
        'src/button.css',
        'src/scss-helpers.ts',
        // Read as an asset, never handed to a preprocessor.
        'src/button.scss?raw',
      ])
    ).toEqual([]);
  });

  // Without `pre`, `vite:css` transforms first and fails with its own `sass-embedded` message, so
  // every assertion above still passes while the user sees none of it.
  it('runs ahead of `vite:css`, whose message it exists to replace', () => {
    expect(stylePreprocessorCheckPlugin().enforce).toBe('pre');
  });

  it('is registered by viteFinal, which is the only thing that runs it', async () => {
    const result = await viteFinal({ root: WORKSPACE_ROOT }, optionsWith({}));

    expect(result.plugins).toContainEqual(
      expect.objectContaining({ name: 'storybook-angular-vite-style-preprocessor-check' })
    );
  });
});

describe('angularOptionsPlugin global styles', () => {
  const previewPath = resolve(WORKSPACE_ROOT, '.storybook', 'preview.ts');

  beforeEach(() => {
    vi.mocked(findConfigFile).mockReturnValue(previewPath);
    vol.fromJSON(
      {
        'src/styles.css': '',
        'src/styles.scss': '',
        'src/theme.scss': '',
        'apps/ui-storybook/.storybook/tailwind.css': '',
        'node_modules/dso-toolkit/dist/dso.css': '',
      },
      WORKSPACE_ROOT
    );
    vi.mocked(statSync).mockImplementation(memfs.statSync as unknown as typeof statSync);
  });

  afterEach(() => {
    vol.reset();
    vi.mocked(statSync).mockReset();
  });

  const runTransform = (styles: unknown[]) => {
    const options = {
      configDir: resolve(WORKSPACE_ROOT, '.storybook'),
      angularBuilderContext: { workspaceRoot: WORKSPACE_ROOT },
      angularBuilderOptions: { styles },
    } as unknown as StandaloneOptions;

    const plugin = angularOptionsPlugin(options, { normalizePath, zoneless: true });
    (plugin.config as (userConfig: unknown) => unknown)({ root: WORKSPACE_ROOT });
    return (plugin.transform as any).call({}, '// preview', previewPath) as Promise<{
      code: string;
    }>;
  };

  it('imports both `styles` spellings the builder schema accepts', async () => {
    const { code } = await runTransform([
      'src/styles.scss',
      { input: 'src/theme.scss', bundleName: 'theme' },
    ]);

    expect(code).toContain(`import '${resolve(WORKSPACE_ROOT, 'src/styles.scss')}';`);
    expect(code).toContain(`import '${resolve(WORKSPACE_ROOT, 'src/theme.scss')}';`);
  });

  // The Vite root is the project directory in a monorepo, while Angular resolves `styles` against
  // the workspace root above it. Reproduces spartan-ng: `apps/ui-storybook/.storybook/tailwind.css`
  // reached Vite as a bare specifier and 500'd the whole preview module.
  it('resolves a workspace-relative style against the workspace root, not the Vite root', async () => {
    const options = {
      configDir: resolve(WORKSPACE_ROOT, 'apps/ui-storybook/.storybook'),
      angularBuilderContext: { workspaceRoot: WORKSPACE_ROOT },
      angularBuilderOptions: { styles: ['apps/ui-storybook/.storybook/tailwind.css'] },
    } as unknown as StandaloneOptions;
    const projectPreview = resolve(WORKSPACE_ROOT, 'apps/ui-storybook/.storybook/preview.ts');
    vi.mocked(findConfigFile).mockReturnValue(projectPreview);

    const plugin = angularOptionsPlugin(options, { normalizePath, zoneless: true });
    // The Vite root is the project dir, a level below the workspace root.
    (plugin.config as (userConfig: unknown) => unknown)({
      root: resolve(WORKSPACE_ROOT, 'apps/ui-storybook'),
    });
    const { code } = (await (plugin.transform as any).call({}, '// preview', projectPreview)) as {
      code: string;
    };

    expect(code).toContain(
      `import '${normalizePath(resolve(WORKSPACE_ROOT, 'apps/ui-storybook/.storybook/tailwind.css'))}';`
    );
    expect(code).not.toContain("import 'apps/ui-storybook/.storybook/tailwind.css';");
    expect(code).not.toContain('apps/ui-storybook/apps/ui-storybook');
  });

  it('leaves the zone.js package specifier alone', async () => {
    const options = {
      configDir: resolve(WORKSPACE_ROOT, '.storybook'),
      angularBuilderContext: { workspaceRoot: WORKSPACE_ROOT },
      angularBuilderOptions: { styles: ['src/styles.css'] },
    } as unknown as StandaloneOptions;
    vi.mocked(findConfigFile).mockReturnValue(previewPath);

    const plugin = angularOptionsPlugin(options, { normalizePath, zoneless: false });
    (plugin.config as (userConfig: unknown) => unknown)({ root: WORKSPACE_ROOT });
    const { code } = (await (plugin.transform as any).call({}, '// preview', previewPath)) as {
      code: string;
    };

    expect(code).toContain("import 'zone.js';");
  });

  // A package specifier is a legitimate Angular `styles` entry: the builder hands it to a resolver
  // anchored at the workspace root that falls through to node_modules, where dso-toolkit only is.
  it('emits a package specifier bare, so Vite resolves it through node_modules', async () => {
    const { code } = await runTransform(['dso-toolkit/dist/dso.css']);

    expect(code).toContain("import 'dso-toolkit/dist/dso.css';");
    expect(code).not.toContain(resolve(WORKSPACE_ROOT, 'dso-toolkit/dist/dso.css'));
  });

  it('resolves a `./`-prefixed entry against the workspace root, not the preview file', async () => {
    const { code } = await runTransform(['./src/styles.css']);

    expect(code).toContain(`import '${resolve(WORKSPACE_ROOT, 'src/styles.css')}';`);
    expect(code).not.toContain("import './src/styles.css';");
  });

  it('resolves an extensionless entry to the stylesheet on disk', async () => {
    const { code } = await runTransform(['src/theme']);

    expect(code).toContain(`import '${resolve(WORKSPACE_ROOT, 'src/theme.scss')}';`);
  });

  // `dist/canopy/canopy.css` is a real corpus entry and a build output: on disk in a built
  // workspace, absent in a clean checkout.
  it('emits a bare-looking entry with no file on disk as a specifier, not a workspace path', async () => {
    const { code } = await runTransform(['dist/canopy/canopy.css']);

    expect(code).toContain("import 'dist/canopy/canopy.css';");
    expect(code).not.toContain(resolve(WORKSPACE_ROOT, 'dist/canopy/canopy.css'));
  });

  it('never resolves a directory as a stylesheet', async () => {
    const { code } = await runTransform(['src']);

    expect(code).toContain("import 'src';");
    expect(code).not.toContain(`import '${resolve(WORKSPACE_ROOT, 'src')}';`);
  });

  it('fails with the entry the user wrote when a path-shaped entry has no file', async () => {
    await expect(runTransform(['./src/missing.css'])).rejects.toThrow(AngularUnresolvedStyleError);
    await expect(runTransform(['./src/missing.css'])).rejects.toThrow(
      /Cannot resolve the stylesheet '\.\/src\/missing\.css' from the Angular workspace root/
    );
  });

  it('ignores malformed object-form styles from the environment bridge', async () => {
    const { code } = await runTransform([
      {},
      null,
      { input: 42 },
      'src/styles.scss',
      { input: 'src/theme.scss' },
    ]);

    expect(code).toContain(`import '${resolve(WORKSPACE_ROOT, 'src/styles.scss')}';`);
    expect(code).toContain(`import '${resolve(WORKSPACE_ROOT, 'src/theme.scss')}';`);
    expect(code).not.toContain(`import '${resolve(WORKSPACE_ROOT, 'undefined')}';`);
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

  const loadStub = (id: string) => {
    const load = compodocJsonStubPlugin(CONFIG_DIR).load as (
      this: unknown,
      id: string
    ) => string | null;
    const code = load.call({}, id);
    const serialized = code?.match(/^export default (.*);$/s)?.[1];
    expect(serialized).toBeDefined();
    return JSON.parse(serialized!);
  };

  it('stubs the documented preview import when Compodoc never wrote the file', async () => {
    expect(await runResolve('../documentation.json', null)).toBe(
      '\0storybook-angular-vite/empty-compodoc-json'
    );
  });

  // The expected shape is `compodoc -e json` output, down to which keys are arrays.
  it('stands in an empty value of the shape Compodoc writes for every key it exports', async () => {
    const docJson = loadStub('\0storybook-angular-vite/empty-compodoc-json');

    expect(docJson).toEqual({
      classes: [],
      components: [],
      coverage: { count: 0, status: 'low', files: [] },
      directives: [],
      guards: [],
      interceptors: [],
      interfaces: [],
      injectables: [],
      miscellaneous: {
        enumerations: [],
        functions: [],
        groupedEnumerations: {},
        groupedFunctions: {},
        groupedTypeAliases: {},
        groupedVariables: {},
        typealiases: [],
        variables: [],
      },
      modules: [],
      pipes: [],
      routes: { name: '<root>', kind: 'module', children: [] },
    });
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
    await viteFinal({ root: WORKSPACE_ROOT }, optionsWith({ propsTable: 'api' }));

    expect(
      vi
        .mocked(logger.warn)
        .mock.calls.map(([message]) => String(message))
        .join('\n')
    ).toContain('experimentalDocgenServer');
  });

  const warningsFor = async (featureFlags: Record<string, boolean>) => {
    await viteFinal({ root: WORKSPACE_ROOT }, optionsWith({}, featureFlags));
    return vi
      .mocked(logger.warn)
      .mock.calls.map(([message]) => String(message))
      .join('\n');
  };

  it('points a components-manifest build with the docgen server off at the flag that fixes it', async () => {
    const warnings = await warningsFor({
      componentsManifest: true,
      experimentalDocgenServer: false,
    });

    expect(warnings).toContain('no components manifest');
    expect(warnings).toContain('features: { experimentalDocgenServer: true }');
  });

  // `@storybook/addon-mcp` turns `componentsManifest` on from its own `features` hook, so the key
  // need not be in the user's `main.ts`.
  it('does not tell the user to drop a feature an addon set on their behalf', async () => {
    const warnings = await warningsFor({
      componentsManifest: true,
      experimentalDocgenServer: false,
    });

    expect(warnings).not.toMatch(/drop|remove/i);
  });

  it('stays quiet about the components manifest when the docgen server is on', async () => {
    await expect(
      warningsFor({ componentsManifest: true, experimentalDocgenServer: true })
    ).resolves.not.toContain('componentsManifest');
  });

  it('stays quiet about the components manifest when it was never asked for', async () => {
    await expect(warningsFor({ experimentalDocgenServer: false })).resolves.not.toContain(
      'componentsManifest'
    );
  });
});
