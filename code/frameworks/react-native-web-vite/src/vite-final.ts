import type { InlineConfig } from 'vite';
import { rnw } from 'vite-plugin-rnw';
import tsconfigPaths from 'vite-tsconfig-paths';

import type { FrameworkOptions } from './types.ts';

/** Add the React Native Web plugins to a config that already has the React plugins. */
export async function withReactNativeWeb(
  config: InlineConfig,
  { pluginReactOptions = {}, modulesToTranspile = [] }: FrameworkOptions
): Promise<InlineConfig> {
  const { mergeConfig } = await import('vite');
  const { plugins = [], ...configWithoutPlugins } = config;

  return mergeConfig(configWithoutPlugins, {
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
}

function getExcludeOptions(modulesToTranspile: string[]): { exclude?: RegExp } {
  const defaultModulesToTranspile = ['react-native', '@react-native', 'expo', '@expo'];
  const uniqueModulesToTranspile = Array.from(
    new Set([...modulesToTranspile, ...defaultModulesToTranspile])
  );

  if (modulesToTranspile.length) {
    // produce a regex of `/\/node_modules\/(?!react-native|@react-native|expo|@expo|[others])/`
    return { exclude: new RegExp(`/node_modules/(?!${uniqueModulesToTranspile.join('|')})`) };
  }

  return {};
}
