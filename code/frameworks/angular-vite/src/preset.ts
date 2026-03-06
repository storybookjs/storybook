import type { PresetProperty } from 'storybook/internal/types';

import { fileURLToPath, resolve } from 'node:url';

import type { StandaloneOptions } from './builders/utils/standalone-options';
import type { FrameworkOptions } from './types';
import type { UserConfig, Plugin } from 'vite';

export const addons: PresetProperty<'addons'> = [];

export const previewAnnotations: PresetProperty<'previewAnnotations'> = async (
  entries = [],
  options
) => {
  const config = fileURLToPath(
    import.meta.resolve('@storybook/angular-vite/client/config'),
  );
  const annotations = [...entries, config];

  if ((options as any as StandaloneOptions).enableProdMode) {
    const previewProdPath = fileURLToPath(
      import.meta.resolve('@storybook/angular-vite/client/preview-prod'),
    );
    annotations.unshift(previewProdPath);
  }

  const docsConfig = await options.presets.apply('docs', {}, options);
  const docsEnabled = Object.keys(docsConfig).length > 0;
  if (docsEnabled) {
    const docsConfigPath = fileURLToPath(
      import.meta.resolve('@storybook/angular-vite/client/docs/config'),
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
  angularBuilderOptions: StandaloneOptions['angularBuilderOptions'],
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
  // Remove any loaded analogjs plugins from a vite.config.(m)ts file
  config.plugins = (config.plugins ?? [])
    .flat()
    .filter((plugin: any) => !plugin.name.includes('analogjs'));

  // Merge custom configuration into the default config
  const { mergeConfig, normalizePath } = await import('vite');
  const { default: angular } = await import('@analogjs/vite-plugin-angular');

  // @ts-ignore
  const framework = await options.presets.apply('framework');
  const experimentalZoneless = await resolveExperimentalZoneless(
    framework.options,
    options?.angularBuilderOptions,
  );
  return mergeConfig(config, {
    // Add dependencies to pre-optimization
    optimizeDeps: {
      include: [
        '@storybook/angular-vite/client',
        '@storybook/angular-vite',
        '@angular/compiler',
        '@angular/platform-browser',
        '@angular/platform-browser/animations',
        'tslib',
        ...(experimentalZoneless ? [] : ['zone.js']),
      ],
    },
    plugins: [
      angular({
        jit:
          typeof framework.options?.jit !== 'undefined'
            ? framework.options?.jit
            : true,
        liveReload:
          typeof framework.options?.liveReload !== 'undefined'
            ? framework.options?.liveReload
            : false,
        tsconfig:
          typeof framework.options?.tsconfig !== 'undefined'
            ? framework.options?.tsconfig
            : (options?.tsConfig ?? './.storybook/tsconfig.json'),
        inlineStylesExtension:
          typeof framework.options?.inlineStylesExtension !== 'undefined'
            ? framework.options?.inlineStylesExtension
            : 'css',
      }),
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
  { normalizePath, experimentalZoneless }: any,
): Plugin {
  let resolvedConfig: UserConfig;
  return {
    name: 'storybook-angular-vite-options-plugin',
    config(userConfig: UserConfig) {
      resolvedConfig = userConfig;
      const loadPaths =
        options?.angularBuilderOptions?.stylePreprocessorOptions?.loadPaths;
      const sassOptions =
        options?.angularBuilderOptions?.stylePreprocessorOptions?.sass;

      if (Array.isArray(loadPaths)) {
        const workspaceRoot =
          options.angularBuilderContext?.workspaceRoot ??
          userConfig?.root ??
          process.cwd();
        return {
          css: {
            preprocessorOptions: {
              scss: {
                ...sassOptions,
                loadPaths: loadPaths.map(
                  (loadPath) => `${resolve(workspaceRoot, loadPath)}`,
                ),
              },
            },
          },
        };
      }

      return;
    },
    async transform(code, id) {
      if (
        normalizePath(id).endsWith(
          normalizePath(`${options.configDir}/preview.ts`),
        )
      ) {
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
                if (
                  extraImport.startsWith('.') ||
                  extraImport.startsWith('src')
                ) {
                  // relative to root
                  return `import '${resolve(projectRoot, extraImport)}';`;
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
    apply: 'build',
    config() {
      return {
        esbuild: {
          // Don't mangle class names during the build
          // This fixes display of compodoc argtypes
          keepNames: true,
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
