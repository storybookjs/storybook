import { createRequire } from 'node:module';

import StorybookNormalizeAngularEntryPlugin from './plugins/storybook-normalize-angular-entry-plugin';
import { filterOutStylingRules } from './utils/filter-out-styling-rules';

const require = createRequire(import.meta.url);

// Private angular devkit stuff
const {
  generateI18nBrowserWebpackConfigFromContext,
} = require('@angular-devkit/build-angular/src/utils/webpack-browser-config');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

const {
  getCommonConfig,
  getStylesConfig,
  getDevServerConfig,
  getTypeScriptConfig,
} = require('@angular-devkit/build-angular/src/tools/webpack/configs');

/**
 * Extract webpack config from angular-cli 13.x.x ⚠️ This file is in JavaScript to not use
 * TypeScript. Because current storybook TypeScript version is not compatible with Angular CLI.
 * FIXME: Try another way with TypeScript on future storybook version (7 maybe 🤞)
 *
 * @param {any} baseConfig Previous webpack config from storybook
 * @param {any} options { builderOptions, builderContext }
 */
export const getWebpackConfig = async (baseConfig, { builderOptions, builderContext }) => {
  /** Get angular-cli Webpack config */

  /**
   * Custom styles config that handles Tailwind 4 compatibility issues.
   *
   * Problem: Angular's getStylesConfig() doesn't support Tailwind 4's new PostCSS plugin
   * architecture. When Tailwind 4 is detected, Angular tries to load it using the old v3 API which
   * throws errors.
   *
   * Solution: Detect Tailwind 4, bypass Angular's automatic Tailwind detection by hiding config
   * files, then manually inject the correct Tailwind 4 PostCSS plugin into the webpack
   * configuration.
   */
  async function getCustomStylesConfig(wco) {
    const { root } = wco;

    /**
     * Detect if Tailwind 4 is being used by checking for the new @tailwindcss/postcss package.
     * Tailwind 4 uses @tailwindcss/postcss instead of the main tailwindcss package for PostCSS
     * integration.
     */
    const isTailwind4 = () => {
      try {
        const output = import.meta.resolve('@tailwindcss/postcss', root);
        return isAbsolute(output);
      } catch {
        return false;
      }
    };

    if (isTailwind4()) {
      // Monkey patch readdir to make findTailwindConfigurationFile return undefined
      const fs = require('node:fs/promises');
      const originalReaddir = fs.readdir;

      /**
       * Hide Tailwind config files from Angular's automatic detection. This prevents Angular from
       * trying to load Tailwind using the incompatible v3 API. By filtering out tailwind config
       * files, findTailwindConfigurationFile() returns undefined, and Angular skips its built-in
       * Tailwind setup entirely.
       */
      fs.readdir = async function (path, options) {
        const results = await originalReaddir.call(this, path, options);
        const tailwindFiles = [
          'tailwind.config.js',
          'tailwind.config.cjs',
          'tailwind.config.mjs',
          'tailwind.config.ts',
        ];
        // Filter out tailwind config files from the results
        return results.filter((file) => !tailwindFiles.includes(file));
      };

      // Get styles config without Tailwind interference
      const styleConfig = await getStylesConfig(wco);

      // Restore original readdir immediately after getting styles config
      fs.readdir = originalReaddir;

      /**
       * Manually inject Tailwind 4 PostCSS plugin into the webpack configuration. Since we bypassed
       * Angular's automatic Tailwind detection, we need to manually add the correct Tailwind 4
       * plugin to all PostCSS loader configurations.
       */
      const tailwindPackagePath = import.meta.resolve('@tailwindcss/postcss', root);
      const tailwindPackage = await import(tailwindPackagePath);
      const extraPostcssPlugins = [
        typeof tailwindPackage === 'function' ? tailwindPackage() : tailwindPackage.default(),
      ];

      /**
       * Navigate through webpack's complex rule structure to find all postcss-loader instances and
       * inject the Tailwind 4 plugin. This preserves Angular's existing PostCSS setup while adding
       * Tailwind 4 support.
       */
      styleConfig.module.rules
        .map((rule) => rule.rules)
        .forEach((rule) => {
          rule.forEach((r) => {
            r.oneOf?.forEach?.((oneOfRule) => {
              return oneOfRule.use.forEach((use) => {
                if (use.loader.includes('postcss-loader') && use.options.postcssOptions) {
                  const originalOptionsFn = use.options.postcssOptions;
                  // Wrap the original postcssOptions function to append Tailwind 4 plugin
                  use.options.postcssOptions = (loaderOptions) => {
                    const originalOptions = originalOptionsFn(loaderOptions);

                    return {
                      ...originalOptions,
                      plugins: [...originalOptions.plugins, ...extraPostcssPlugins],
                    };
                  };
                }
              });
            });
          });
        });

      return styleConfig;
    } else {
      // Use Angular's default styles config for Tailwind v3 and other CSS frameworks
      return getStylesConfig(wco);
    }
  }

  const { config: cliConfig } = await generateI18nBrowserWebpackConfigFromContext(
    {
      // Default options
      index: 'noop-index',
      main: 'noop-main',

      // Options provided by user
      ...builderOptions,
      styles: builderOptions.styles
        ?.map((style) => (typeof style === 'string' ? style : style.input))
        .filter((style) => typeof style === 'string' || style.inject !== false),
      outputPath:
        typeof builderOptions.outputPath === 'string'
          ? builderOptions.outputPath
          : (builderOptions.outputPath?.base ?? 'noop-out'),

      // Fixed options
      optimization: false,
      namedChunks: false,
      progress: false,
      buildOptimizer: false,
      aot: false,
    },
    builderContext,
    (wco) => [
      getCommonConfig(wco),
      getCustomStylesConfig(wco),
      getTypeScriptConfig ? getTypeScriptConfig(wco) : getDevServerConfig(wco),
    ]
  );

  if (!builderOptions.experimentalZoneless && !cliConfig.entry.polyfills?.includes('zone.js')) {
    cliConfig.entry.polyfills ??= [];
    cliConfig.entry.polyfills.push('zone.js');
  }

  /** Merge baseConfig Webpack with angular-cli Webpack */
  const entry = [
    ...(cliConfig.entry.polyfills ?? []),
    ...baseConfig.entry,
    ...(cliConfig.entry.styles ?? []),
  ];

  // Don't use storybooks styling rules because we have to use rules created by @angular-devkit/build-angular
  // because @angular-devkit/build-angular created rules have include/exclude for global style files.
  const rulesExcludingStyles = filterOutStylingRules(baseConfig);
  const module = {
    ...baseConfig.module,
    rules: [...cliConfig.module.rules, ...rulesExcludingStyles],
  };

  const plugins = [
    ...(cliConfig.plugins ?? []),
    ...baseConfig.plugins,
    new StorybookNormalizeAngularEntryPlugin(),
  ];

  const resolve = {
    ...baseConfig.resolve,
    modules: Array.from(new Set([...baseConfig.resolve.modules, ...cliConfig.resolve.modules])),
    plugins: [
      new TsconfigPathsPlugin({
        configFile: builderOptions.tsConfig,
        mainFields: ['browser', 'module', 'main'],
      }),
    ],
  };

  return {
    ...baseConfig,
    entry,
    module,
    plugins,
    resolve,
    resolveLoader: cliConfig.resolveLoader,
  };
};
