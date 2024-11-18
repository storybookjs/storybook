// @ts-expect-error FIXME
import { viteFinal as reactViteFinal } from '@storybook/react-vite/preset';

import type { BabelOptions, Options as ReactOptions } from '@vitejs/plugin-react';
import react from '@vitejs/plugin-react';
import type { PluginOption } from 'vite';

import type { FrameworkOptions, StorybookConfig } from './types';

function reactNativeWeb(
  reactOptions: Omit<ReactOptions, 'babel'> & { babel?: BabelOptions }
): PluginOption {
  return {
    name: 'vite:react-native-web',
    config(_userConfig, env) {
      return {
        define: {
          // reanimated support
          'global.__x': {},
          _frameTimestamp: undefined,
          _WORKLET: false,
          __DEV__: `${env.mode === 'development'}`,
          'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || env.mode),
        },
        optimizeDeps: {
          include: [],
          esbuildOptions: {
            jsx: 'transform',
            resolveExtensions: [
              '.web.js',
              '.web.ts',
              '.web.tsx',
              '.js',
              '.jsx',
              '.json',
              '.ts',
              '.tsx',
              '.mjs',
            ],
            loader: {
              '.js': 'jsx',
            },
          },
        },
        resolve: {
          extensions: [
            '.web.js',
            '.web.ts',
            '.web.tsx',
            '.js',
            '.jsx',
            '.json',
            '.ts',
            '.tsx',
            '.mjs',
          ],
          alias: {
            'react-native': 'react-native-web',
          },
        },
      };
    },
  };
}

export const viteFinal: StorybookConfig['viteFinal'] = async (config, options) => {
  const { pluginReactOptions = {} } =
    await options.presets.apply<FrameworkOptions>('frameworkOptions');

  const reactConfig = await reactViteFinal(config, options);
  const { plugins = [] } = reactConfig;

  plugins.unshift(
    react({
      babel: {
        babelrc: false,
        configFile: false,
      },
      jsxRuntime: 'automatic',
      ...pluginReactOptions,
    })
  );
  plugins.push(reactNativeWeb(pluginReactOptions));

  return reactConfig;
};

export const core = {
  builder: '@storybook/builder-vite',
  renderer: '@storybook/react',
};
