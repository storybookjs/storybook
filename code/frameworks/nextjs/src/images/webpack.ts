import { fileURLToPath } from 'node:url';

import type { NextConfig } from 'next';
import semver from 'semver';
import type { RuleSetRule, Configuration as WebpackConfig } from 'webpack';

import { getNextjsVersion } from '../utils';

export const configureImages = (baseConfig: WebpackConfig, nextConfig: NextConfig): void => {
  configureStaticImageImport(baseConfig, nextConfig);
  configureImageDefaults(baseConfig);
};

const fallbackFilename = 'static/media/[path][name][ext]';

const configureImageDefaults = (baseConfig: WebpackConfig): void => {
  const version = getNextjsVersion();
  const resolve = baseConfig.resolve ?? {};
  resolve.alias = {
    ...resolve.alias,
    'sb-original/next/image': fileURLToPath(import.meta.resolve('next/image')),
    'next/image': '@storybook/nextjs/images/next-image',
  };

  if (semver.satisfies(version, '>=13.0.0')) {
    resolve.alias = {
      ...resolve.alias,
      'sb-original/next/legacy/image': fileURLToPath(import.meta.resolve('next/legacy/image')),
      'next/legacy/image': '@storybook/nextjs/images/next-legacy-image',
    };
  }
};

const configureStaticImageImport = (baseConfig: WebpackConfig, nextConfig: NextConfig): void => {
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
        loader: fileURLToPath(import.meta.resolve('@storybook/nextjs/next-image-loader-stub')),
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
