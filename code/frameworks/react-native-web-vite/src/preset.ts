import { viteFinal as reactViteFinal } from '@storybook/react-vite/preset';

import type { InlineConfig } from 'vite';
import { rnw } from 'vite-plugin-rnw';
import tsconfigPaths from 'vite-tsconfig-paths';

import type { FrameworkOptions, StorybookConfig } from './types';

export const viteFinal: StorybookConfig['viteFinal'] = async (config, options) => {
  const { mergeConfig } = await import('vite');

  const { pluginReactOptions = {} } =
    await options.presets.apply<FrameworkOptions>('frameworkOptions');

  const { plugins = [], ...reactConfigWithoutPlugins } = await reactViteFinal(config, options);

  return mergeConfig(reactConfigWithoutPlugins, {
    plugins: [
      tsconfigPaths(),

      rnw({
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
  builder: '@storybook/builder-vite',
  renderer: '@storybook/react',
};
