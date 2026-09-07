import { findConfigFile } from 'storybook/internal/common';
import {
  babelParser,
  extractMockCalls,
  findMockRedirect,
  getAutomockCode,
  getRealPath,
} from 'storybook/internal/mocking-utils';
import { logger } from 'storybook/internal/node-logger';
import {
  AngularMissingStylePreprocessorError,
  AngularUnresolvedStyleError,
} from 'storybook/internal/server-errors';
import type { PresetProperty, StorybookConfigRaw } from 'storybook/internal/types';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DOCUMENTATION_JSON, resolveCompodocConfig } from './compodoc-config.ts';
import { resolvePropsTable, warnAboutPropsTable } from './props-table.ts';
import { ensureCompodocDocumentation } from './compodoc/ensure-documentation.ts';
import type { StandaloneOptions } from './builders/utils/standalone-options.ts';
import type { UserConfig, Plugin } from 'vite';

export { experimental_docgenProvider, experimental_manifests } from './docgen/preset.ts';
export { experimental_storyDocsProvider } from './docgen/story-docs-preset.ts';

export const addons: PresetProperty<'addons'> = [];

// `angular-vite` is itself experimental, so it ships one docgen path rather than two: server-side
// extraction is the default here, while the stable webpack `@storybook/angular` keeps Compodoc.
// A user's `main.ts` merges over this, so `features: { experimentalDocgenServer: false }` opts out.
export const features: PresetProperty<'features'> = async (existing) => ({
  ...existing,
  experimentalDocgenServer: true,
});

export const previewAnnotations: PresetProperty<'previewAnnotations'> = async (
  entries = [],
  options
) => {
  const config = fileURLToPath(import.meta.resolve('@storybook/angular-vite/client/config'));
  const annotations = [...entries, config];

  if ((options as any as StandaloneOptions).enableProdMode) {
    const previewProdPath = fileURLToPath(
      import.meta.resolve('@storybook/angular-vite/client/preview-prod')
    );
    annotations.unshift(previewProdPath);
  }

  const docsConfig = await options.presets.apply('docs', {}, options);
  const docsEnabled = Object.keys(docsConfig).length > 0;
  if (docsEnabled) {
    const docsConfigPath = fileURLToPath(
      import.meta.resolve('@storybook/angular-vite/client/docs/config')
    );
    annotations.push(docsConfigPath);
  }
  return annotations;
};

export const core: PresetProperty<'core'> = async (config, options) => {
  const framework = await options.presets.apply('framework');

  return {
    ...config,
    builder: {
      name: import.meta.resolve('@storybook/builder-vite'),
      options: typeof framework === 'string' ? {} : framework.options.builder || {},
    },
  };
};

export function resolveZoneless(angularBuilderOptions: StandaloneOptions['angularBuilderOptions']) {
  return angularBuilderOptions?.zoneless ?? true;
}

export const viteFinal = async (config: UserConfig, options?: StandaloneOptions) => {
  // Hydrate angularBuilderOptions from the env var set by the parent
  // storybook dev/build process when this preset runs in the addon-vitest
  // child (where no BuilderContext is available).
  if (
    options &&
    !options.angularBuilderOptions &&
    process.env.STORYBOOK_ANGULAR_BUILDER_OPTIONS_JSON
  ) {
    try {
      options.angularBuilderOptions = JSON.parse(
        process.env.STORYBOOK_ANGULAR_BUILDER_OPTIONS_JSON
      );
    } catch {
      // leave undefined; graceful degradation
    }
  }

  // Drop any analogjs plugin loaded from the user's vite.config(.m)ts file —
  // we register our own pinned-to-`enforce: 'pre'` instance below.
  // The post-analogjs `angularViteRedirectReapplyPlugin` handles every mock
  // contract (redirects + automock) on top of analogjs's emitted JS, so we
  // don't need to demote `storybook:mock-loader` here.
  config.plugins = (config.plugins ?? [])
    .flat()
    .filter((plugin: any) => !plugin?.name?.includes('analogjs'));

  // Merge custom configuration into the default config
  const { mergeConfig, normalizePath } = await import('vite');
  const { default: angular } = await import('@analogjs/vite-plugin-angular');

  // @ts-expect-error options is possibly undefined here, but presets.apply is guarded at runtime
  const framework = await options.presets.apply('framework');

  // @ts-expect-error same as `framework` above: `options` is optional in the signature only
  const resolvedFeatures: StorybookConfigRaw['features'] = await options.presets.apply(
    'features',
    {}
  );
  const docgenServer = !!resolvedFeatures?.experimentalDocgenServer;

  // With the docgen server on, ACM extracts in-process and nothing reads `documentation.json`, so
  // the whole-project scan (1.0 s to 35.6 s on real repositories) buys nothing.
  const compodocConfig = await resolveCompodocConfig(options, { viteRoot: config?.root });
  if (compodocConfig.enabled && !docgenServer) {
    await ensureCompodocDocumentation({
      compodocArgs: compodocConfig.compodocArgs,
      tsconfig: compodocConfig.tsconfig,
      workspaceRoot: compodocConfig.workspaceRoot,
      outputDir: compodocConfig.outputDir,
    });
  }

  const propsTable = resolvePropsTable(framework.options, resolvedFeatures);
  warnAboutPropsTable(framework.options, resolvedFeatures);

  if (resolvedFeatures?.componentsManifest && !docgenServer) {
    logger.warn(
      `The \`componentsManifest\` feature needs the \`experimentalDocgenServer\` feature, which is off, so this Storybook publishes no components manifest ` +
        `and MCP clients get no component API from it. ` +
        `Turn the docgen server on with \`features: { experimentalDocgenServer: true }\` in your \`main.ts\`.`
    );
  }

  const zoneless = resolveZoneless(options?.angularBuilderOptions);
  const angularPlugins = angular({
    jit: typeof framework.options?.jit !== 'undefined' ? framework.options?.jit : true,
    liveReload:
      typeof framework.options?.liveReload !== 'undefined' ? framework.options?.liveReload : false,
    tsconfig:
      typeof framework.options?.tsconfig !== 'undefined'
        ? framework.options?.tsconfig
        : (options?.tsConfig ?? './.storybook/tsconfig.json'),
    inlineStylesExtension:
      typeof framework.options?.inlineStylesExtension !== 'undefined'
        ? framework.options?.inlineStylesExtension
        : 'css',
  });

  // Pin the main `@analogjs/vite-plugin-angular` plugin to `enforce: 'pre'`
  // so it transforms `.ts` sources before storybook's automock plugin
  // (`storybook:mock-loader`) runs. analogjs's transform re-emits files
  // from its own internal Angular file emitter and discards the incoming
  // `code`, so anything mock-loader did upstream is wiped unless those
  // plugins run *after* analogjs (`angularViteRedirectReapplyPlugin`).
  // addon-docs' CSF plugin stays in the same `pre` bucket but uses
  // `transform.order: 'post'` so enrichment lands on analogjs output.
  const pluginsToInject = (Array.isArray(angularPlugins) ? angularPlugins : [angularPlugins])
    .filter(Boolean)
    .map((plugin: any) => {
      if (plugin?.name === '@analogjs/vite-plugin-angular' && !plugin.enforce) {
        return { ...plugin, enforce: 'pre' as const };
      }
      return plugin;
    });

  return mergeConfig(config, {
    // `build` already falls back to `compilerOptions.paths` once normal resolution fails, so an
    // Angular workspace alias with no `node_modules` counterpart already resolves in `build`
    // today; `dev` only consults `paths` when this is on, so the same alias fails to serve.
    // Turning it on closes that gap, but for a specifier that resolves both ways - a tsconfig
    // path alongside a `node_modules` copy of the same package - it also flips precedence to the
    // tsconfig target in `build`, not just `dev`. See MIGRATION.md.
    resolve: {
      tsconfigPaths: config.resolve?.tsconfigPaths ?? true,
    },
    // Add dependencies to pre-optimization
    optimizeDeps: {
      include: [
        '@storybook/angular-vite/client',
        '@storybook/angular-vite',
        '@angular/compiler',
        '@angular/platform-browser',
        '@angular/platform-browser/animations',
        '@angular/common/http',
        'tslib',
        ...(zoneless ? [] : ['zone.js']),
      ],
    },
    build: {
      rolldownOptions: {
        output: {
          // Preserve original class/function names through the production
          // bundle. Compodoc-derived argTypes are looked up by class name at
          // runtime (`findComponentByName(component.name, …)`), and the
          // angular-vite `cleanArgsDecorator` strips any arg whose argType
          // lacks an `action` or `control` flag. If the bundler renames
          // `ButtonComponent` → `f` the lookup fails, no Output argTypes
          // are emitted, and `onClick`/other handlers get stripped from args
          // before the renderer sees them — manifesting as missing action
          // bindings and unbound @Input() values (e.g. core-argmapping).
          // Rolldown's oxc minifier renames by default, so the production
          // bundle needs this explicit opt-in.
          keepNames: true,
          // Rolldown's lazy-init wrapper splits @angular/platform-browser and
          // @angular/common/http into separate chunks. The platform-browser
          // chunk extends a class imported from the http xhr chunk but the
          // generated wrapper never invokes the dependent init thunk, leaving
          // the imported class undefined at evaluation time. Merging them keeps
          // the inheritance contiguous in a single chunk.
          manualChunks(id: string) {
            if (id.includes('@angular/platform-browser') || id.includes('@angular/common')) {
              return 'angular-platform';
            }
            return undefined;
          },
        },
      },
    },
    plugins: [
      ...pluginsToInject,
      angularViteRedirectReapplyPlugin(options),
      angularOptionsPlugin(options, { normalizePath, zoneless }),
      stylePreprocessorCheckPlugin(),
      storybookOxcPlugin(),
      ...(docgenServer && options?.configDir ? [compodocJsonStubPlugin(options.configDir)] : []),
    ],
    define: {
      STORYBOOK_ANGULAR_OPTIONS: JSON.stringify({
        zoneless: !!zoneless,
        propsTable,
      }),
    },
  });
};

const COMPODOC_JSON_STUB_ID = '\0storybook-angular-vite/empty-compodoc-json';

// Every key `compodoc -e json` writes, in the shape it writes it, so a preview that spreads or
// drills into one finds an empty value rather than `undefined`.
const EMPTY_COMPODOC_JSON: Record<string, unknown> = {
  classes: [],
  components: [],
  coverage: { count: 0, status: 'low', files: [] },
  directives: [],
  guards: [],
  injectables: [],
  interceptors: [],
  interfaces: [],
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
};

// `storybook init` writes a static `import docJson from '../documentation.json'` into the Angular
// preview, and that file is normally gitignored Compodoc output. With the docgen server on nothing
// generates it and nothing reads it, so resolve it to an empty document rather than failing the
// build of a project that followed the documented setup.
export function compodocJsonStubPlugin(configDir: string): Plugin {
  // Only the import `storybook init` wrote into the Storybook config is stood in for. A
  // `documentation.json` the project imports from anywhere else is the user's own file, and a
  // missing one there has to fail the way any missing import does.
  const importedFromStorybookConfig = (importer: string | undefined) => {
    if (!importer) {
      return false;
    }
    const fromConfigDir = relative(configDir, importer);
    return fromConfigDir !== '' && !fromConfigDir.startsWith('..') && !isAbsolute(fromConfigDir);
  };

  return {
    name: 'storybook-angular-vite-compodoc-json-stub',
    enforce: 'pre',
    async resolveId(source, importer, resolveOptions) {
      if (basename(source) !== DOCUMENTATION_JSON || !importedFromStorybookConfig(importer)) {
        return null;
      }
      const resolved = await this.resolve(source, importer, { ...resolveOptions, skipSelf: true });
      return resolved ? null : COMPODOC_JSON_STUB_ID;
    },
    load(id) {
      return id === COMPODOC_JSON_STUB_ID
        ? `export default ${JSON.stringify(EMPTY_COMPODOC_JSON)};`
        : null;
    },
  };
}

const STYLE_EXTENSIONS = ['.css', '.scss', '.sass', '.less'];

const isFile = (path: string) => statSync(path, { throwIfNoEntry: false })?.isFile() === true;

// Angular resolves a `styles` entry relative-first from the workspace root and only then through
// node_modules: `preferRelative` on the webpack builder's enhanced-resolve, an esbuild `@import`
// with `resolveDir: workspaceRoot` on the esbuild builder. Both spellings occur in the wild.
function resolveBuilderStyle(stylePath: string, workspaceRoot: string) {
  const workspacePath = resolve(workspaceRoot, stylePath);
  const onDisk = [workspacePath, ...STYLE_EXTENSIONS.map((ext) => workspacePath + ext)].find(
    isFile
  );
  if (onDisk) {
    return onDisk;
  }

  // Emitting a path-shaped entry verbatim would make Vite resolve it against `preview.ts` rather
  // than the workspace root, and node_modules cannot rescue one either.
  if (isAbsolute(stylePath) || /^\.\.?[/\\]/.test(stylePath)) {
    throw new AngularUnresolvedStyleError({
      stylePath,
      workspaceRoot,
      extensions: STYLE_EXTENSIONS,
    });
  }

  return stylePath;
}

const STYLE_PREPROCESSORS: Record<string, { install: string; alternative?: string }> = {
  scss: { install: 'sass', alternative: 'sass-embedded' },
  sass: { install: 'sass', alternative: 'sass-embedded' },
  less: { install: 'less' },
};

const STYLE_PREPROCESSOR_ID = /\.(scss|sass|less)(?:$|\?)/;

// Vite's own css plugins exclude these queries from their transform, so a `.scss?raw` import is
// read as an asset and never reaches a preprocessor. Aborting the build for one would refuse a
// project that compiles.
const SPECIAL_QUERY_ID = /[?&](?:worker|sharedworker|raw|url)\b/;

// Asks whether the package is present, not whether its entry point resolves: this check aborts the
// build, and Vite loads preprocessors with its own conditions, so an `exports` map without a
// `require` condition resolves for Vite and throws here. The `createRequire` arm is only for Yarn
// PnP, which has no `node_modules` to walk; `import.meta.resolve` cannot replace it, because its
// `parent` argument is silently ignored without `--experimental-import-meta-resolve`.
const isPackagePresentFrom = (pkg: string, fromDir: string) => {
  let dir = resolve(fromDir);
  while (true) {
    if (existsSync(join(dir, 'node_modules', pkg, 'package.json'))) {
      return true;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  try {
    createRequire(join(fromDir, 'noop.js')).resolve(pkg);
    return true;
  } catch (error) {
    // Node found the package and refused only its entry point, because the `exports` map has no
    // `require` condition. Vite resolves with its own conditions, so that is present, not missing.
    return (error as NodeJS.ErrnoException)?.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED';
  }
};

const viteInstallDir = () => {
  try {
    return dirname(fileURLToPath(import.meta.resolve('vite')));
  } catch {
    return undefined;
  }
};

const isInstalledNear = (pkg: string, root: string) =>
  [root, viteInstallDir()]
    .filter((dir): dir is string => !!dir)
    .some((dir) => isPackagePresentFrom(pkg, dir));

export function stylePreprocessorCheckPlugin(): Plugin {
  // Same two directories and same order as `loadPreprocessorPath`, so a preprocessor reported
  // missing here is one Vite is about to fail on too.
  let root = process.cwd();
  const installed = new Map<string, boolean>();

  return {
    name: 'storybook-angular-vite-style-preprocessor-check',
    // Ahead of the core `vite:css` transform, so the actionable error replaces Vite's instead of
    // arriving after it.
    enforce: 'pre',
    configResolved(config) {
      root = config.root;
      installed.clear();
    },
    transform: {
      filter: { id: { include: STYLE_PREPROCESSOR_ID, exclude: SPECIAL_QUERY_ID } },
      handler(_code, id) {
        const lang = SPECIAL_QUERY_ID.test(id) ? undefined : STYLE_PREPROCESSOR_ID.exec(id)?.[1];
        const preprocessor = lang ? STYLE_PREPROCESSORS[lang] : undefined;
        if (!lang || !preprocessor) {
          return;
        }

        if (!installed.has(lang)) {
          const candidates = [preprocessor.install, preprocessor.alternative].filter(
            (pkg): pkg is string => !!pkg
          );
          installed.set(
            lang,
            candidates.some((pkg) => isInstalledNear(pkg, root))
          );
        }

        if (!installed.get(lang)) {
          throw new AngularMissingStylePreprocessorError({
            stylePath: id.split('?')[0],
            install: preprocessor.install,
            alternative: preprocessor.alternative,
          });
        }
      },
    },
  };
}

export function angularOptionsPlugin(
  options: StandaloneOptions,
  { normalizePath, zoneless }: any
): Plugin {
  let resolvedPreviewPath: string | undefined;
  // Angular resolves builder paths against the workspace root, which in a monorepo is a level (or
  // several) above the Vite root. Both `stylePreprocessorOptions` and `styles` need it.
  let workspaceRoot = process.cwd();
  return {
    name: 'storybook-angular-vite-options-plugin',
    config(userConfig: UserConfig) {
      resolvedPreviewPath = findConfigFile('preview', options.configDir) ?? undefined;
      workspaceRoot =
        options.angularBuilderContext?.workspaceRoot ?? userConfig?.root ?? process.cwd();
      const stylePreprocessorOptions =
        options?.angularBuilderOptions?.stylePreprocessorOptions ?? {};
      // Angular's builder schema (and this framework's builder schema) names the
      // SCSS search-path array `includePaths`, matching angular.json. dart-sass
      // and Vite call the same thing `loadPaths`; accept that spelling too so
      // configs written against either convention work. `includePaths` wins when
      // both are present.
      const loadPaths = stylePreprocessorOptions.includePaths ?? stylePreprocessorOptions.loadPaths;
      const sassOptions = stylePreprocessorOptions.sass;

      if (!Array.isArray(loadPaths) && !sassOptions) {
        return;
      }

      return {
        css: {
          preprocessorOptions: {
            scss: {
              ...sassOptions,
              ...(Array.isArray(loadPaths)
                ? { loadPaths: loadPaths.map((loadPath) => `${resolve(workspaceRoot, loadPath)}`) }
                : {}),
            },
          },
        },
      };
    },
    async transform(code, id) {
      if (resolvedPreviewPath && normalizePath(id).endsWith(normalizePath(resolvedPreviewPath))) {
        const imports: string[] = [];
        const styles = options?.angularBuilderOptions?.styles;

        if (Array.isArray(styles)) {
          styles.forEach((style) => {
            const stylePath =
              typeof style === 'string'
                ? style
                : style !== null &&
                    typeof style === 'object' &&
                    'input' in style &&
                    typeof style.input === 'string'
                  ? style.input
                  : undefined;
            if (stylePath !== undefined) {
              imports.push(normalizePath(resolveBuilderStyle(stylePath, workspaceRoot)));
            }
          });
        }

        if (!zoneless) {
          imports.push('zone.js');
        }

        return {
          code: `
            ${imports.map((extraImport) => `import '${extraImport}';`).join('\n')}
            ${code}
          `,
        };
      }

      return;
    },
  };
}

// Re-apply Storybook's mock contracts AFTER analogjs has compiled the file.
//
// In Storybook's UI dev path, builder-vite has already populated `config.plugins`
// by the time the framework's `viteFinal` runs, so we can demote
// `storybook:mock-loader`'s `transform.order: 'pre'` out of the `pre` bucket and
// let it transparently wrap exports after analogjs's `enforce: 'pre'`. Under
// addon-vitest the framework's `viteFinal` is invoked with no plugins yet
// registered (the storybookTest plugin merges them later), so the in-place
// demote is a no-op and the original mock-loader's pre-stage transform fires
// before analogjs — analogjs then discards the upstream `code` and re-emits
// from its own TS emitter, dropping every mock.
//
// To stay correct in both paths we run our own post-stage plugin that consumes
// the same mock calls and re-applies them on whatever analogjs produced:
//   - `__mocks__/…` redirect → return the redirect file contents.
//   - plain `sb.mock(...)` automock → wrap the post-analogjs exports with
//     `getAutomockCode(code, spy, parse)`.
function angularViteRedirectReapplyPlugin(options?: StandaloneOptions): Plugin {
  let viteConfig: { resolve?: { preserveSymlinks?: boolean } } = {};
  let redirects: Array<{ absolutePath: string; redirectPath: string }> = [];
  let automocks: Array<{ absolutePath: string; spy: boolean }> = [];
  return {
    name: 'storybook-angular-vite-redirect-reapply',
    configResolved(c) {
      viteConfig = c as any;
    },
    buildStart() {
      if (!options?.configDir) {
        return;
      }
      const previewConfigPath = findConfigFile('preview', options.configDir);
      if (!previewConfigPath) {
        return;
      }
      try {
        const calls = extractMockCalls(
          { previewConfigPath, configDir: options.configDir },
          babelParser,
          (viteConfig as any).root ?? process.cwd(),
          findMockRedirect
        );
        redirects = calls
          .filter(
            (
              call
            ): call is { absolutePath: string; redirectPath: string; spy: boolean; path: string } =>
              !!call.redirectPath
          )
          .map((call) => ({
            absolutePath: call.absolutePath,
            redirectPath: call.redirectPath,
          }));
        automocks = calls
          .filter((call) => !call.redirectPath && !!call.absolutePath)
          .map((call) => ({ absolutePath: call.absolutePath, spy: !!call.spy }));
      } catch {
        redirects = [];
        automocks = [];
      }
    },
    async transform(code: string, id: string) {
      if (redirects.length === 0 && automocks.length === 0) {
        return null;
      }
      const preserveSymlinks = !!viteConfig.resolve?.preserveSymlinks;
      const idNorm = getRealPath(id, preserveSymlinks);
      for (const r of redirects) {
        if (getRealPath(r.absolutePath, preserveSymlinks) !== idNorm) {
          continue;
        }
        this.addWatchFile(r.redirectPath);
        return {
          code: readFileSync(r.redirectPath, 'utf-8'),
          map: { mappings: '' },
        };
      }
      for (const a of automocks) {
        if (getRealPath(a.absolutePath, preserveSymlinks) !== idNorm) {
          continue;
        }
        // analogjs only transforms Angular TS sources, so for plain JS modules
        // (e.g. lodash-es/sum.js) the pre-stage `storybook:mock-loader`
        // automock survives into our `code` input. Re-wrapping it would
        // redeclare the `__vitest_current_es_module__` / `__vitest_mocked_*`
        // identifiers and break the bundle. Detect the existing wrapper and
        // leave the file alone in that case.
        if (code.includes('__vitest_current_es_module__')) {
          return null;
        }
        try {
          const automocked = getAutomockCode(code, a.spy, babelParser as any);
          return {
            code: automocked.toString(),
            map: automocked.generateMap(),
          };
        } catch {
          return null;
        }
      }
      return null;
    },
  };
}

function storybookOxcPlugin() {
  return {
    name: 'storybook-angular-vite-oxc-config',
    config() {
      return {
        oxc: {
          jsx: { runtime: 'automatic' },
        },
      };
    },
  };
}

export const typescript: PresetProperty<'typescript'> = async (config) => {
  return {
    ...config,
    skipCompiler: true,
  };
};
