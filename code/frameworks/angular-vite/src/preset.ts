import type { PresetProperty } from 'storybook/internal/types';

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { StandaloneOptions } from './builders/utils/standalone-options.ts';
import type { FrameworkOptions } from './types.ts';
import type { ConfigEnv, UserConfig, Plugin } from 'vite';

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

async function resolveExperimentalZoneless(
  frameworkOptions: FrameworkOptions,
  angularBuilderOptions: StandaloneOptions['angularBuilderOptions']
) {
  // 1. Explicit framework option (user's .storybook/main.ts)
  if (typeof frameworkOptions?.experimentalZoneless === 'boolean') {
    return frameworkOptions.experimentalZoneless;
  }

  // 2. Angular builder options (set by start-storybook/build-storybook)
  if (typeof angularBuilderOptions?.experimentalZoneless === 'boolean') {
    return angularBuilderOptions.experimentalZoneless;
  }

  // 3. Auto-detect Angular 21+ (matches @storybook/angular builder behavior)
  try {
    const { VERSION } = await import('@angular/core');
    return !!(VERSION.major && Number(VERSION.major) >= 21);
  } catch {
    return false;
  }
}

export const viteFinal = async (config: UserConfig, options?: StandaloneOptions) => {
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
  config.plugins = (config.plugins ?? [])
    .flat()
    .filter((plugin: any) => !plugin.name.includes('analogjs'))
    .map((plugin: any) => {
      if (plugin?.name === 'plugin-csf' && plugin.enforce === 'pre') {
        return { ...plugin, enforce: undefined };
      }
      // mock-loader's `transform.order: 'pre'` runs before analogjs's
      // `enforce: 'pre'` (hook-level order beats plugin-level enforce in
      // Vite), and analogjs then re-emits the file from its own TS emitter,
      // discarding mock-loader's automock output. Demote mock-loader out of
      // 'pre' so it runs in the normal stage after analogjs has produced its
      // compiled JS — the automock then operates on that JS and survives to
      // the bundle.
      if (plugin?.name === 'storybook:mock-loader' && plugin.transform?.order === 'pre') {
        const { order: _order, ...restTransform } = plugin.transform;
        return { ...plugin, transform: restTransform };
      }
      return plugin;
    });

  // Merge custom configuration into the default config
  const { mergeConfig, normalizePath } = await import('vite');
  const { default: angular } = await import('@analogjs/vite-plugin-angular');

  // @ts-expect-error options is possibly undefined here, but presets.apply is guarded at runtime
  const framework = await options.presets.apply('framework');
  const experimentalZoneless = await resolveExperimentalZoneless(
    framework.options,
    options?.angularBuilderOptions
  );
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
  // above and the mock re-apply plugin defined below).
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
        ...(experimentalZoneless ? [] : ['zone.js']),
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
          // bindings and unbound @Input() values (e.g. core-argmapping). The
          // esbuild `keepNames` flag only governs the per-file TS→JS
          // transform; the final minified bundle is produced by Rolldown's
          // oxc minifier and needs its own opt-in here.
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
      angularOptionsPlugin(options, { normalizePath, experimentalZoneless }),
      storybookEsbuildPlugin(),
    ],
    define: {
      STORYBOOK_ANGULAR_OPTIONS: JSON.stringify({
        experimentalZoneless: !!experimentalZoneless,
      }),
    },
  });
};

function angularOptionsPlugin(
  options: StandaloneOptions,
  { normalizePath, experimentalZoneless }: any
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

        if (!experimentalZoneless) {
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

function storybookEsbuildPlugin() {
  return {
    name: 'storybookjs-angular-vite-esbuild-config',
    config(_userConfig: UserConfig, env: ConfigEnv) {
      return {
        esbuild: {
          // Don't mangle class names during the build
          // This fixes display of compodoc argtypes
          keepNames: true,
          ...(env.command === 'build' ? { keepNames: true } : {}),
          jsx: 'automatic',
        },
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
