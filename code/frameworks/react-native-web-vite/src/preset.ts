import { viteFinal as reactViteFinal } from '@storybook/react-vite/preset';

import type { InlineConfig } from 'vite';
import { rnw } from 'vite-plugin-rnw';
import tsconfigPaths from 'vite-tsconfig-paths';

import type { FrameworkOptions, StorybookConfig } from './types';

const getExcludeOptions = (modulesToTranspile: string[]) => {
  const defaultModulesToTranspile = ['react-native', '@react-native', 'expo', '@expo'];
  const uniqueModulesToTranspile = Array.from(
    new Set([...modulesToTranspile, ...defaultModulesToTranspile])
  );

  if (modulesToTranspile.length) {
    // produce a regex of `/\/node_modules\/(?!react-native|@react-native|expo|@expo|[others])/`
    return { exclude: new RegExp(`/node_modules/(?!${uniqueModulesToTranspile.join('|')})`) };
  }

  return {};
};

export const viteFinal: StorybookConfig['viteFinal'] = async (config, options) => {
  const { mergeConfig } = await import('vite');

  const { pluginReactOptions = {}, modulesToTranspile = [] } =
    await options.presets.apply<FrameworkOptions>('frameworkOptions');

  const { plugins = [], ...reactConfigWithoutPlugins } = await reactViteFinal(config, options);

  return mergeConfig(reactConfigWithoutPlugins, {
    plugins: [
      tsconfigPaths(),

      rnw({
        ...getExcludeOptions(modulesToTranspile),
        ...pluginReactOptions,
        jsxRuntime: pluginReactOptions.jsxRuntime || 'automatic',
        babel: {
          babelrc: false,
          configFile: false,
          ...pluginReactOptions.babel,
        },
      }),

      ...plugins,
    ],
  } satisfies InlineConfig);
};

export const core = {
  builder: import.meta.resolve('@storybook/builder-vite'),
  renderer: import.meta.resolve('@storybook/react/preset'),
};
