import { fileURLToPath } from 'node:url';

import { logger } from 'storybook/internal/node-logger';
import type { Options } from 'storybook/internal/types';

import type { Configuration } from 'webpack';

export async function createDefaultWebpackConfig(
  storybookBaseConfig: Configuration,
  options: Options
): Promise<Configuration> {
  if (
    options.presetsList?.some((preset) =>
      /@storybook(\/|\\)preset-create-react-app/.test(
        typeof preset === 'string' ? preset : preset.name
      )
    )
  ) {
    return storybookBaseConfig;
  }

  const hasPostcssAddon = options.presetsList?.some((preset) =>
    /@storybook(\/|\\)addon-postcss/.test(typeof preset === 'string' ? preset : preset.name)
  );

  let cssLoaders = {};
  if (!hasPostcssAddon) {
    logger.info(`Using implicit CSS loaders`);
    cssLoaders = {
      test: /\.css$/,
      sideEffects: true,
      use: [
        // TODO: Decide if we want to keep style-loader & css-loader in core
        // Trying to apply style-loader or css-loader to files that already have been
        // processed by them causes webpack to crash, so no one else can add similar
        // loader configurations to the `.css` extension.
        fileURLToPath(import.meta.resolve('style-loader')),
        {
          loader: fileURLToPath(import.meta.resolve('css-loader')),
          options: {
            importLoaders: 1,
          },
        },
      ],
    };
  }

  const isProd = storybookBaseConfig.mode !== 'development';

  return {
    ...storybookBaseConfig,
    // TODO: Implement the clearing functionality of StyledConsoleLogger so that we can use it for webpack
    // The issue currently is that the status line is not cleared when the webpack compiler is run,
    // which causes the status line to be printed multiple times.
    // infrastructureLogging: {
    //   console: new StyledConsoleLogger({ prefix: 'Webpack', color: 'bgBlue' }),
    // },
    module: {
      ...storybookBaseConfig.module,
      rules: [
        ...(storybookBaseConfig.module?.rules || []),
        cssLoaders,
        {
          test: /\.(svg|ico|jpg|jpeg|png|apng|gif|eot|otf|webp|ttf|woff|woff2|cur|ani|pdf)(\?.*)?$/,
          type: 'asset/resource',
          generator: {
            filename: isProd
              ? 'static/media/[name].[contenthash:8][ext]'
              : 'static/media/[path][name][ext]',
          },
        },
        {
          test: /\.(mp4|webm|wav|mp3|m4a|aac|oga)(\?.*)?$/,
          type: 'asset',
          parser: {
            dataUrlCondition: {
              maxSize: 10000,
            },
          },
          generator: {
            filename: isProd
              ? 'static/media/[name].[contenthash:8][ext]'
              : 'static/media/[path][name][ext]',
          },
        },
        {
          // any imports from './some-file.md?raw' will be imported as raw string
          // see https://webpack.js.org/guides/asset-modules/#replacing-inline-loader-syntax
          // used to support import raw .md files in MDX
          resourceQuery: /raw/,
          type: 'asset/source',
        },
      ],
    },
    resolve: {
      ...storybookBaseConfig.resolve,
      // see https://github.com/webpack/webpack/issues/17692#issuecomment-1866272674 for the docs
      conditionNames: [
        ...(storybookBaseConfig.resolve?.conditionNames ?? []),
        'storybook',
        'stories',
        'test',
        '...',
      ],
      fallback: {
        crypto: false,
        assert: false,
        ...storybookBaseConfig.resolve?.fallback,
      },
    },
  };
}
