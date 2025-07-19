import { dirname, resolve as resolvePath } from 'node:path';

import { logger } from 'storybook/internal/node-logger';

import type { NextConfig } from 'next';
import semver from 'semver';
import type { RuleSetRule, Configuration as WebpackConfig } from 'webpack';

import { getCustomImageLoaderConfig } from '../utils';
import { getNextjsVersion } from '../utils';

export const configureImages = (
  baseConfig: WebpackConfig,
  nextConfig: NextConfig,
  nextConfigPath?: string
): void => {
  configureStaticImageImport(baseConfig, nextConfig);
  let customLoaderPath: string | null = null;

  try {
    const customLoaderConfig = getCustomImageLoaderConfig(nextConfig);
    if (customLoaderConfig) {
      const configDir = nextConfigPath ? dirname(nextConfigPath) : process.cwd();

      customLoaderPath = require.resolve(customLoaderConfig.loaderFile, { paths: [configDir] });
      logger.info(`=> Using custom image loader: ${customLoaderConfig.loaderFile}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.warn(`=> Failed to resolve custom image loader: ${errorMessage}`);
    logger.warn('=> Falling back to default image loader');
  }

  configureImageDefaults(baseConfig, customLoaderPath);
};

const fallbackFilename = 'static/media/[path][name][ext]';

const configureImageDefaults = (
  baseConfig: WebpackConfig,
  customLoaderPath: string | null
): void => {
  const version = getNextjsVersion();
  const resolve = baseConfig.resolve ?? {};

  resolve.alias = {
    ...resolve.alias,
    'sb-original/next/image': require.resolve('next/image'),
    'next/image': resolvePath(__dirname, './images/next-image'),
  };

  if (customLoaderPath) {
    try {
      // Load the custom loader function
      delete require.cache[customLoaderPath];
      const loaderModule = require(customLoaderPath);
      const customLoaderFunction = loaderModule.default || loaderModule;

      if (typeof customLoaderFunction === 'function') {
        baseConfig.plugins = baseConfig.plugins || [];
        const webpack = require('webpack');
        baseConfig.plugins.push(
          new webpack.DefinePlugin({
            __STORYBOOK_CUSTOM_LOADER__: `(${customLoaderFunction.toString()})`,
          })
        );
        logger.info('=> Custom image loader integrated successfully');
      } else {
        logger.warn('=> Custom loader file does not export a function, using default loader');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(`=> Failed to load custom image loader: ${errorMessage}`);
      logger.warn('=> Using default image loader instead');
    }
  }

  if (semver.satisfies(version, '>=13.0.0')) {
    resolve.alias = {
      ...resolve.alias,
      'sb-original/next/legacy/image': require.resolve('next/legacy/image'),
      'next/legacy/image': resolvePath(__dirname, './images/next-legacy-image'),
    };
  }
};

const configureStaticImageImport = (baseConfig: WebpackConfig, nextConfig: NextConfig): void => {
  const version = getNextjsVersion();

  const rules = baseConfig.module?.rules;

  const assetRule = rules?.find(
    (rule) =>
      rule && typeof rule !== 'string' && rule.test instanceof RegExp && rule.test.test('test.jpg')
  ) as RuleSetRule;

  if (!assetRule) {
    return;
  }

  assetRule.test = /\.(apng|eot|otf|ttf|woff|woff2|cur|ani|pdf)(\?.*)?$/;

  rules?.push({
    test: /\.(png|jpg|jpeg|gif|webp|avif|ico|bmp|svg)$/i,
    issuer: { not: /\.(css|scss|sass)$/ },
    use: [
      {
        loader: require.resolve('@storybook/nextjs/next-image-loader-stub.js'),
        options: {
          filename: assetRule.generator?.filename ?? fallbackFilename,
          nextConfig,
        },
      },
    ],
  });
  rules?.push({
    test: /\.(png|jpg|jpeg|gif|webp|avif|ico|bmp|svg)$/i,
    issuer: /\.(css|scss|sass)$/,
    type: 'asset/resource',
    generator: {
      filename: assetRule.generator?.filename ?? fallbackFilename,
    },
  });
};
