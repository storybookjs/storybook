import { findConfigFile } from 'storybook/internal/common';
import {
  babelParser,
  extractMockCalls,
  findMockRedirect,
  getAutomockCode,
  getRealPath,
} from 'storybook/internal/mocking-utils';
import type { PresetProperty } from 'storybook/internal/types';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { StandaloneOptions } from './builders/utils/standalone-options.ts';
import type { UserConfig, Plugin } from 'vite';

export const addons: PresetProperty<'addons'> = [];

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

function resolveZoneless(angularBuilderOptions: StandaloneOptions['angularBuilderOptions']) {
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

  // Remove any loaded analogjs plugins from a vite.config.(m)ts file, and
  // demote storybook's CSF plugin out of the "pre" bucket. csf-plugin and
  // analogjs both declare `enforce: 'pre'`; within the same enforce bucket
  // plugins run in registration order. builder-vite registers `plugin-csf`
  // first, then this preset adds analogjs, so analogjs's transform — which
  // discards the incoming `code` and re-emits from its own TS file emitter —
  // silently overwrites the csf enrichment that adds
  // `parameters.docs.description.story` / `parameters.docs.source
  // .originalSource`. Demoting csf-plugin to the normal stage means it runs
  // after analogjs has produced its compiled JS, so the enrichment lands in
  // the bundle. csf-plugin reads the original source from disk (not the
  // upstream `code`), so the JSDoc/source extraction is unaffected.
  // Drop any analogjs plugin loaded from the user's vite.config(.m)ts file —
  // we register our own pinned-to-`enforce: 'pre'` instance below. Demote
  // builder-vite's csf-plugin out of the `pre` bucket so analogjs (also
  // `enforce: 'pre'`) doesn't overwrite csf-plugin's docs/story enrichment.
  // The post-analogjs `angularViteRedirectReapplyPlugin` handles every mock
  // contract (redirects + automock) on top of analogjs's emitted JS, so we
  // don't need to demote `storybook:mock-loader` here.
  config.plugins = (config.plugins ?? [])
    .flat()
    .filter((plugin: any) => !plugin.name.includes('analogjs'))
    .map((plugin: any) => {
      if (plugin?.name === 'plugin-csf' && plugin.enforce === 'pre') {
        return { ...plugin, enforce: undefined };
      }
      return plugin;
    });

  // Merge custom configuration into the default config
  const { mergeConfig, normalizePath } = await import('vite');
  const { default: angular } = await import('@analogjs/vite-plugin-angular');

  // @ts-expect-error options is possibly undefined here, but presets.apply is guarded at runtime
  const framework = await options.presets.apply('framework');

  // Generate compodoc's documentation.json on cold start when no builder
  // path has produced it yet (e.g. addon-vitest child, ng run without the
  // Angular CLI builder). Skipped when the file already exists or when the
  // user opts out via framework.options.compodoc === false.
  if (framework.options?.compodoc !== false) {
    const { existsSync } = await import('node:fs');
    const path = await import('node:path');
    const workspaceRoot =
      (options as any)?.angularBuilderContext?.workspaceRoot ?? config?.root ?? process.cwd();
    const documentationJsonPath = path.resolve(workspaceRoot, 'documentation.json');
    if (!existsSync(documentationJsonPath)) {
      const { runCompodoc } = await import('./builders/utils/run-compodoc.ts');
      const tsconfig =
        framework.options?.tsconfig ??
        (options as any)?.tsConfig ??
        (options as any)?.angularBuilderOptions?.tsConfig ??
        path.resolve(workspaceRoot, 'tsconfig.json');
      const compodocArgs = framework.options?.compodocArgs ?? ['-e', 'json', '-d', '.'];
      try {
        await runCompodoc({ compodocArgs, tsconfig, workspaceRoot });
      } catch (err) {
        console.warn('[storybook-angular-vite] compodoc generation failed:', err);
      }
    }
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
  // `code`, so anything mock-loader or csf-plugin did upstream is wiped
  // unless those plugins run *after* analogjs (see csf-plugin demote
  // above and `angularViteRedirectReapplyPlugin`).
  const pluginsToInject = (Array.isArray(angularPlugins) ? angularPlugins : [angularPlugins])
    .filter(Boolean)
    .map((plugin: any) => {
      if (plugin?.name === '@analogjs/vite-plugin-angular' && !plugin.enforce) {
        return { ...plugin, enforce: 'pre' as const };
      }
      return plugin;
    });

  return mergeConfig(config, {
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
      storybookOxcPlugin(),
      shortChunkNamesPlugin(),
    ],
    define: {
      STORYBOOK_ANGULAR_OPTIONS: JSON.stringify({
        zoneless: !!zoneless,
      }),
    },
  });
};

function angularOptionsPlugin(
  options: StandaloneOptions,
  { normalizePath, zoneless }: any
): Plugin {
  let resolvedConfig: UserConfig;
  return {
    name: 'storybook-angular-vite-options-plugin',
    config(userConfig: UserConfig) {
      resolvedConfig = userConfig;
      const loadPaths = options?.angularBuilderOptions?.stylePreprocessorOptions?.loadPaths;
      const sassOptions = options?.angularBuilderOptions?.stylePreprocessorOptions?.sass;

      if (Array.isArray(loadPaths)) {
        const workspaceRoot =
          options.angularBuilderContext?.workspaceRoot ?? userConfig?.root ?? process.cwd();
        return {
          css: {
            preprocessorOptions: {
              scss: {
                ...sassOptions,
                loadPaths: loadPaths.map((loadPath) => `${resolve(workspaceRoot, loadPath)}`),
              },
            },
          },
        };
      }

      return;
    },
    async transform(code, id) {
      if (normalizePath(id).endsWith(normalizePath(`${options.configDir}/preview.ts`))) {
        const imports = [];
        const styles = options?.angularBuilderOptions?.styles;

        if (Array.isArray(styles)) {
          styles.forEach((style) => {
            imports.push(style);
          });
        }

        if (!zoneless) {
          imports.push('zone.js');
        }

        // Use vite config root when angularBuilderContext is not available
        // (e.g., when running via Vitest instead of Angular builders)
        const projectRoot = resolvedConfig?.root ?? process.cwd();

        return {
          code: `
            ${imports
              .map((extraImport) => {
                if (extraImport.startsWith('.') || extraImport.startsWith('src')) {
                  // relative to root — normalize to forward slashes so the
                  // generated import specifier is valid on Windows.
                  return `import '${normalizePath(resolve(projectRoot, extraImport))}';`;
                }

                // absolute import
                return `import '${extraImport}';`;
              })
              .join('\n')}
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

// analogjs's JIT support emits virtual modules for inline component styles
// whose module id embeds the whole base64-encoded stylesheet. The bundler
// derives chunk file names from the module id, which can exceed the OS's
// 255-byte file name limit. Trim the name and let the content hash keep it
// unique. Implemented as an outputOptions hook (not vite config) so it
// survives the rollupOptions/rolldownOptions config normalization across
// vite versions.
function shortChunkNamesPlugin(): Plugin {
  return {
    name: 'storybook-angular-vite-short-chunk-names',
    outputOptions(outputOpts: any) {
      const original = outputOpts.chunkFileNames ?? 'assets/[name]-[hash].js';
      outputOpts.chunkFileNames = (chunkInfo: { name: string }) => {
        const pattern = typeof original === 'function' ? original(chunkInfo) : (original as string);
        if (chunkInfo.name && chunkInfo.name.length > 64) {
          return pattern.replace('[name]', chunkInfo.name.slice(0, 64));
        }
        return pattern;
      };
      return outputOpts;
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
