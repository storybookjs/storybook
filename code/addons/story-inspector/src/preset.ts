import type { StorybookConfig } from 'storybook/internal/types';

import { componentPathInjectorPlugin } from './utils/vite-plugin';

export const viteFinal = async (config: any, options: any): Promise<any> => {
  const plugins = config.plugins || [];

  // Add our component path injector plugin
  plugins.push(componentPathInjectorPlugin(options));

  return {
    ...config,
    plugins,
  };
};
