import type { Options } from 'storybook/internal/types';

import { componentPathInjectorPlugin } from './utils/vite-plugin';

export const viteFinal = async (
  config: import('vite').UserConfig,
  options: Options
): Promise<import('vite').UserConfig> => {
  const plugins = config.plugins || [];

  // Add our component path injector plugin
  plugins.push(componentPathInjectorPlugin(options));

  return {
    ...config,
    plugins,
  };
};
