import { fileURLToPath } from 'node:url';

import { isPreservingSymlinks } from '@storybook/core/internal/common';
import type { PreviewSources } from '@storybook/core/internal/preview-page';
import { EXPORT_ORDER_FILE_PATTERN } from '@storybook/core/internal/preview-page';
import type { StorybookConfigRaw } from '@storybook/core/internal/types';

// @ts-expect-error (I removed this on purpose, because it's incorrect)
import CaseSensitivePathsPlugin from 'case-sensitive-paths-webpack-plugin';
import type { TransformOptions as EsbuildOptions } from 'esbuild';
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import { resolve } from 'pathe';
import TerserWebpackPlugin from 'terser-webpack-plugin';
import webpackModule from 'webpack';
import type { Configuration } from 'webpack';
import VirtualModulePlugin from 'webpack-virtual-modules';

import type { BuilderOptions, TypescriptOptions } from '../types.ts';
import {
  developmentPreviewChunkFilename,
  productionPreviewChunkFilename,
} from './preview-filename.ts';
import { getVirtualModuleMapping } from './virtual-module-mapping.ts';

export interface IframeConfigInput {
  isProd: boolean;
  outputDir: string;
  /** Entries loaded before the preview entry. */
  entries: string[];
  builderOptions: BuilderOptions;
  typescriptOptions: Partial<TypescriptOptions>;
  build: StorybookConfigRaw['build'];
  quiet?: boolean;
  modulesCount?: number;
}

const { DefinePlugin, HotModuleReplacementPlugin, ProgressPlugin } = webpackModule;

export const MOCKER_RUNTIME_ASSET = 'mocker-runtime-injected.js';

export function createIframeWebpackConfig(
  preview: PreviewSources,
  input: IframeConfigInput
): Configuration {
  const { isProd, builderOptions, typescriptOptions, build } = input;
  const shouldCheckTs = typescriptOptions.check && !typescriptOptions.skipCompiler;

  return {
    name: 'preview',
    mode: isProd ? 'production' : 'development',
    bail: isProd,
    devtool: build?.test?.disableSourcemaps ? false : 'cheap-module-source-map',
    entry: [...input.entries, preview.virtualModuleIds.entry],
    output: {
      path: resolve(process.cwd(), input.outputDir),
      filename: isProd ? '[name].[contenthash:8].iframe.bundle.js' : '[name].iframe.bundle.js',
      chunkFilename: isProd ? productionPreviewChunkFilename : developmentPreviewChunkFilename,
      publicPath: '',
    },
    stats: {
      preset: 'none',
      logging: 'error',
    },
    watchOptions: {
      ignored: /node_modules/,
    },
    externals: preview.externals,
    ignoreWarnings: [
      {
        message: /export '\S+' was not found in 'global'/,
      },
      {
        message: /export '\S+' was not found in '@storybook\/global'/,
      },
    ],
    plugins: [
      new VirtualModulePlugin(
        getVirtualModuleMapping(preview, {
          lazyCompilation: !!builderOptions.lazyCompilation,
          isProd,
        })
      ),
      new HtmlWebpackPlugin({
        filename: `iframe.html`,
        // FIXME: `none` isn't a known option
        chunksSortMode: 'none' as any,
        alwaysWriteToDisk: true,
        inject: false,
        templateContent: ({ htmlWebpackPlugin }) =>
          preview.html({
            head: [
              ...(htmlWebpackPlugin.files.favicon
                ? [`<link rel="shortcut icon" href="${htmlWebpackPlugin.files.favicon}" />`]
                : []),
              ...htmlWebpackPlugin.files.css.map(
                (file: string) => `<link href="${file}" rel="stylesheet" />`
              ),
            ].join('\n'),
            scripts: `<script type="module">
      import './sb-preview/runtime.js';
${htmlWebpackPlugin.files.js.map((file: string) => `      import './${file}';`).join('\n')}
    </script>`,
            mockerRuntimeUrl: MOCKER_RUNTIME_ASSET,
          }),
        minify: {
          collapseWhitespace: true,
          removeComments: true,
          removeRedundantAttributes: true,
          removeScriptTypeAttributes: false,
          removeStyleLinkTypeAttributes: true,
          useShortDoctype: true,
        },
      }),
      new DefinePlugin(preview.define({ env: 'process.env' })),
      isProd ? null : new HotModuleReplacementPlugin(),
      new CaseSensitivePathsPlugin(),
      input.quiet ? null : new ProgressPlugin({ modulesCount: input.modulesCount }),
      shouldCheckTs ? new ForkTsCheckerWebpackPlugin(typescriptOptions.checkOptions || {}) : null,
    ].filter(Boolean),
    module: {
      // Disable warning for dynamic requires
      unknownContextCritical: false,
      rules: [
        {
          test: EXPORT_ORDER_FILE_PATTERN,
          exclude: /node_modules/,
          enforce: 'post',
          use: [
            {
              loader: fileURLToPath(
                import.meta.resolve('@storybook/builder-webpack5/loaders/export-order-loader')
              ),
            },
          ],
        },
        {
          test: /\.m?js$/,
          type: 'javascript/auto',
        },
        {
          test: /\.m?js$/,
          resolve: {
            fullySpecified: false,
          },
        },
        {
          test: /\.md$/,
          type: 'asset/source',
        },
      ],
    },
    resolve: {
      extensions: ['.mjs', '.js', '.jsx', '.ts', '.tsx', '.json', '.cjs'],
      modules: ['node_modules'].concat(preview.env.NODE_PATH || []),
      mainFields: ['browser', 'module', 'main'],
      // Set webpack to resolve symlinks based on whether the user has asked node to.
      symlinks: !isPreservingSymlinks(),
    },
    optimization: {
      splitChunks: {
        chunks: 'all',
      },
      runtimeChunk: true,
      sideEffects: true,
      usedExports: build?.test?.disableTreeShaking ? false : isProd,
      moduleIds: 'named',
      ...(isProd
        ? {
            minimize: true,
            minimizer: build?.test?.esbuildMinify
              ? [
                  new TerserWebpackPlugin<EsbuildOptions>({
                    parallel: true,
                    minify: TerserWebpackPlugin.esbuildMinify,
                    terserOptions: {
                      sourcemap: !build?.test?.disableSourcemaps,
                      treeShaking: !build?.test?.disableTreeShaking,
                    },
                  }),
                ]
              : [
                  new TerserWebpackPlugin({
                    parallel: true,
                    terserOptions: {
                      sourceMap: !build?.test?.disableSourcemaps,
                      mangle: false,
                      keep_fnames: true,
                    },
                  }),
                ],
          }
        : {}),
    },
    performance: {
      hints: isProd ? 'warning' : false,
    },
    ...(builderOptions.fsCache ? { cache: { type: 'filesystem' as const } } : {}),
    experiments:
      builderOptions.lazyCompilation && !isProd ? { lazyCompilation: { entries: false } } : {},
  };
}
