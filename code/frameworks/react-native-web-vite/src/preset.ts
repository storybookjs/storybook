import { viteFinal as reactViteFinal } from '@storybook/react-vite/preset';

import { esbuildFlowPlugin, flowPlugin } from '@bunchtogether/vite-plugin-flow';
import react from '@vitejs/plugin-react';
import type { InlineConfig, PluginOption } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

import type { FrameworkOptions, StorybookConfig } from './types';

export function reactNativeWeb(): PluginOption {
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
  const { mergeConfig } = await import('vite');

  const { pluginReactOptions = {} } =
    await options.presets.apply<FrameworkOptions>('frameworkOptions');

  const reactConfig = await reactViteFinal(config, options);

  const { plugins = [] } = reactConfig;

  plugins.unshift(
    tsconfigPaths(),
    flowPlugin({
      exclude: [/node_modules\/(?!react-native|@react-native)/],
    }),
    react({
      babel: {
        babelrc: false,
        configFile: false,
      },
      jsxRuntime: 'automatic',
      ...pluginReactOptions,
    })
  );

  plugins.push(reactNativeWeb());

  return mergeConfig(reactConfig, {
    optimizeDeps: {
      esbuildOptions: {
        plugins: [esbuildFlowPlugin(new RegExp(/\.(flow|jsx?)$/), (_path: string) => 'jsx')],
      },
    },
  } satisfies InlineConfig);
};

export const core = {
  builder: '@storybook/builder-vite',
  renderer: '@storybook/react',
};
