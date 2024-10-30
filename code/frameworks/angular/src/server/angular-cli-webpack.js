// Private angular devkit stuff
const {
  generateI18nBrowserWebpackConfigFromContext,
} = require('@angular-devkit/build-angular/src/utils/webpack-browser-config');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const { filterOutStylingRules } = require('./utils/filter-out-styling-rules');
const {
  default: StorybookNormalizeAngularEntryPlugin,
} = require('./plugins/storybook-normalize-angular-entry-plugin');

const getAngularWebpackUtils = () => {
  try {
    // Angular < 16.1.0
    const {
      getCommonConfig,
      getStylesConfig,
      getDevServerConfig,
      getTypeScriptConfig,
    } = require('@angular-devkit/build-angular/src/webpack/configs');

    return {
      getCommonConfig,
      getStylesConfig,
      getDevServerConfig,
      getTypeScriptConfig,
    };
  } catch (e) {
    // Angular > 16.1.0
    const {
      getCommonConfig,
      getStylesConfig,
      getDevServerConfig,
      getTypeScriptConfig,
    } = require('@angular-devkit/build-angular/src/tools/webpack/configs');

    return {
      getCommonConfig,
      getStylesConfig,
      getDevServerConfig,
      getTypeScriptConfig,
    };
  }
};

/**
 * Extract webpack config from angular-cli 13.x.x ⚠️ This file is in JavaScript to not use
 * TypeScript. Because current storybook TypeScript version is not compatible with Angular CLI.
 * FIXME: Try another way with TypeScript on future storybook version (7 maybe 🤞)
 *
 * @param {any} baseConfig Previous webpack config from storybook
 * @param {any} options { builderOptions, builderContext }
 */
exports.getWebpackConfig = async (baseConfig, { builderOptions, builderContext }) => {
  /** Get angular-cli Webpack config */
  const { getCommonConfig, getStylesConfig, getDevServerConfig, getTypeScriptConfig } =
    getAngularWebpackUtils();
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
      getStylesConfig(wco),
      getTypeScriptConfig ? getTypeScriptConfig(wco) : getDevServerConfig(wco),
    ]
  );

  /** Merge baseConfig Webpack with angular-cli Webpack */
  const entry = [
    ...baseConfig.entry,
    ...(cliConfig.entry.styles ?? []),
    ...(cliConfig.entry.polyfills ?? []),
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
