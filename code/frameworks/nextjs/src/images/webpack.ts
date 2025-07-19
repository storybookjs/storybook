import { dirname, resolve as resolvePath } from 'node:path';

import type { NextConfig } from 'next';
import semver from 'semver';
import type { RuleSetRule, Configuration as WebpackConfig } from 'webpack';

import { getCustomImageLoaderConfig } from '../utils';
import { getNextjsVersion } from '../utils';

export const configureImages = (
  baseConfig: WebpackConfig,
  nextConfig: NextConfig,
  nextConfigPath: string
): void => {
  configureStaticImageImport(baseConfig, nextConfig);
  // configureImageDefaults(baseConfig);
  let customLoaderPath: string | null = null;

  try {
    const customLoaderConfig = getCustomImageLoaderConfig(nextConfig);
    console.log('🔧 customLoaderConfig:', customLoaderConfig);
    if (customLoaderConfig) {
      const configDir = nextConfigPath ? dirname(nextConfigPath) : process.cwd();
      console.log('🔧 configDir:', configDir);
      console.log('🔧 trying to resolve:', customLoaderConfig.loaderFile);

      // Resolve the path to the custom loader file
      customLoaderPath = require.resolve(customLoaderConfig.loaderFile, { paths: [configDir] });

      console.log('🔧 Found custom image loader at:', customLoaderPath);
    } else {
      console.log('🔧 No custom loader config found');
    }
  } catch (error) {
    console.error('🔧 Failed to resolve custom image loader:', error);
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
        console.log('🔧 Injected custom loader via DefinePlugin');
      }
    } catch (error) {
      console.error('🔧 Failed to load custom loader for DefinePlugin:', error);
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
