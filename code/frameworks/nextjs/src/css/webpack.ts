import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { NextConfig } from 'next';
import { cssFileResolve } from 'next/dist/build/webpack/config/blocks/css/loaders/file-resolve.js';
import { getCssModuleLocalIdent } from 'next/dist/build/webpack/config/blocks/css/loaders/getCssModuleLocalIdent.js';
import semver from 'semver';
import type { Configuration as WebpackConfig } from 'webpack';

import { resolvePackageDir } from '../../../../core/src/shared/utils/module';

// This tries to follow nextjs's css config, please refer to this file for more info:
// https://github.com/vercel/next.js/blob/canary/packages/next/build/webpack-config.ts

export const configureCss = (baseConfig: WebpackConfig, nextConfig: NextConfig): void => {
  const rules = baseConfig.module?.rules;
  rules?.forEach((rule, i) => {
    if (
      rule &&
      typeof rule !== 'string' &&
      rule.test instanceof RegExp &&
      rule.test.test('test.css')
    ) {
      rules[i] = {
        test: /\.css$/,
        use: [
          fileURLToPath(import.meta.resolve('style-loader')),
          {
            loader: fileURLToPath(import.meta.resolve('css-loader')),
            options: {
              importLoaders: 1,
              ...getImportAndUrlCssLoaderOptions(nextConfig),
              modules: {
                auto: true,
                getLocalIdent: getCssModuleLocalIdent,
              },
            },
          },
          fileURLToPath(import.meta.resolve('postcss-loader')),
        ],
        // We transform the "target.css" files from next.js into Javascript
        // for Next.js to support fonts, so it should be ignored by the css-loader.
        exclude: /next(\\|\/|\\\\).*(\\|\/|\\\\)target\.css$/,
      };
    }
  });
  rules?.push({
    test: /\.(scss|sass)$/,
    use: [
      fileURLToPath(import.meta.resolve('style-loader')),
      {
        loader: fileURLToPath(import.meta.resolve('css-loader')),
        options: {
          importLoaders: 3,
          ...getImportAndUrlCssLoaderOptions(nextConfig),
          modules: { auto: true, getLocalIdent: getCssModuleLocalIdent },
        },
      },
      fileURLToPath(import.meta.resolve('postcss-loader')),
      fileURLToPath(import.meta.resolve('resolve-url-loader')),
      {
        loader: fileURLToPath(import.meta.resolve('sass-loader')),
        options: {
          sourceMap: true,
          sassOptions: nextConfig.sassOptions,
          additionalData:
            nextConfig.sassOptions?.prependData || nextConfig.sassOptions?.additionalData,
        },
      },
    ],
  });
};

/**
 * Webpack v4-v6 api https://webpack.js.org/loaders/css-loader/#url
 * https://webpack.js.org/loaders/css-loader/#import
 *
 * Webpack v3 api https://webpack-3.cdn.bcebos.com/loaders/css-loader/#url
 * https://webpack-3.cdn.bcebos.com/loaders/css-loader/#import
 */
const getImportAndUrlCssLoaderOptions = (nextConfig: NextConfig) =>
  isCssLoaderV6()
    ? {
        url: {
          filter: getUrlResolver(nextConfig),
        },
        import: {
          filter: getImportResolver(nextConfig),
        },
      }
    : {
        url: getUrlResolver(nextConfig),
        import: getImportResolver(nextConfig),
      };

const getUrlResolver = (nextConfig: NextConfig) => (url: string, resourcePath: string) =>
  cssFileResolve(url, resourcePath, nextConfig.experimental?.urlImports);

const getImportResolver =
  (nextConfig: NextConfig) =>
  (url: string | { url: string; media: string }, _: string, resourcePath: string) =>
    cssFileResolve(
      typeof url === 'string' ? url : url.url,
      resourcePath,
      nextConfig.experimental?.urlImports
    );

const isCssLoaderV6 = () => {
  try {
    const cssLoaderVersion = JSON.parse(
      readFileSync(join(resolvePackageDir('css-loader'), 'package.json'), 'utf8')
    ).version;
    return semver.gte(cssLoaderVersion, '6.0.0');
  } catch {
    /**
     * Css-loader isn't a resolvable dependency thus storybook webpack 5 manager will resolve to use
     * its version which is v5
     */
    return false;
  }
};
