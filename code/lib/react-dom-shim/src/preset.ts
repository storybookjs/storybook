import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Options } from 'storybook/internal/types';

/**
 * Get react-dom version from the resolvedReact preset, which points to either a root react-dom
 * dependency or the react-dom dependency shipped with addon-docs
 */
const getIsReactVersion18or19 = async (options: Options) => {
  const { legacyRootApi } =
    (await options.presets.apply<{ legacyRootApi?: boolean } | null>('frameworkOptions')) || {};

  if (legacyRootApi) {
    return false;
  }

  const resolvedReact = await options.presets.apply<{ reactDom?: string }>('resolvedReact', {});
  const reactDom =
    resolvedReact.reactDom || dirname(fileURLToPath(import.meta.resolve('react-dom/package.json')));

  if (!isAbsolute(reactDom)) {
    // if react-dom is not resolved to a file we can't be sure if the version in package.json is correct or even if package.json exists
    // this happens when react-dom is resolved to 'preact/compat' for example
    return false;
  }

  const { version } = JSON.parse(await readFile(join(reactDom, 'package.json'), 'utf-8'));
  return version.startsWith('18') || version.startsWith('19') || version.startsWith('0.0.0');
};

export const webpackFinal = async (config: any, options: Options) => {
  const isReactVersion18 = await getIsReactVersion18or19(options);
  if (isReactVersion18) {
    return config;
  }

  return {
    ...config,
    resolve: {
      ...config.resolve,
      alias: {
        ...config.resolve?.alias,
        '@storybook/react-dom-shim': '@storybook/react-dom-shim/react-16',
      },
    },
  };
};

export const viteFinal = async (config: any, options: Options) => {
  const isReactVersion18 = await getIsReactVersion18or19(options);
  if (isReactVersion18) {
    return config;
  }

  const alias = Array.isArray(config.resolve?.alias)
    ? config.resolve.alias.concat({
        find: /^@storybook\/react-dom-shim$/,
        replacement: '@storybook/react-dom-shim/react-16',
      })
    : {
        ...config.resolve?.alias,
        '@storybook/react-dom-shim': '@storybook/react-dom-shim/react-16',
      };

  return {
    ...config,
    resolve: {
      ...config.resolve,
      alias,
    },
  };
};
