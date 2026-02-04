import { fileURLToPath } from 'node:url';

import type { PresetProperty } from 'storybook/internal/types';

import type { StorybookConfigVite } from '@storybook/builder-vite';
import { viteFinal as reactViteFinal } from '@storybook/react-vite/preset';

import type { FrameworkOptions } from './types';

export const core: PresetProperty<'core'> = async (config, options) => {
  const framework = await options.presets.apply('framework');

  return {
    ...config,
    builder: {
      name: fileURLToPath(import.meta.resolve('@storybook/builder-vite')),
      options: typeof framework === 'string' ? {} : framework.options.builder || {},
    },
    renderer: fileURLToPath(import.meta.resolve('@storybook/react/preset')),
  };
};

export const previewAnnotations: PresetProperty<'previewAnnotations'> = (entry = []) => [
  ...entry,
  fileURLToPath(import.meta.resolve('@storybook/tanstack-react/preview')),
];

export const optimizeViteDeps = ['@tanstack/react-query', '@tanstack/react-router'];

export const viteFinal: StorybookConfigVite['viteFinal'] = async (config, options) => {
  const reactConfig = await reactViteFinal(config, options);

  const frameworkOptions = await options.presets.apply<FrameworkOptions>('frameworkOptions', {});

  /**
   * A custom viteFinal implementation that removes any TanStack Start Vite plugins from the user's
   * Vite config, as a workaround for compatibility issues.
   *
   * This follows the pattern discussed at: https://github.com/storybookjs/storybook/issues/33754
   */
  const isTanStackStartPlugin = (p: unknown): boolean => {
    if (Array.isArray(p)) {
      return p.some(isTanStackStartPlugin);
    }
    return (
      typeof p === 'object' &&
      p !== null &&
      'name' in p &&
      typeof (p as any).name === 'string' &&
      (p as any).name.startsWith('tanstack-start')
    );
  };

  const basePlugins = reactConfig.plugins ?? [];
  const plugins = basePlugins.filter((plugin) => !isTanStackStartPlugin(plugin));

  return {
    ...reactConfig,
    plugins,
  };
};
