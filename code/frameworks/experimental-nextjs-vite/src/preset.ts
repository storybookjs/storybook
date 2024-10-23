// https://storybook.js.org/docs/react/addons/writing-presets
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { PresetProperty } from 'storybook/internal/types';

import type { StorybookConfigVite } from '@storybook/builder-vite';

import { dirname, join } from 'path';
import vitePluginStorybookNextjs from 'vite-plugin-storybook-nextjs';

import type { FrameworkOptions } from './types';

export const core: PresetProperty<'core'> = async (config, options) => {
  const framework = await options.presets.apply('framework');

  return {
    ...config,
    builder: {
      name: fileURLToPath(import.meta.resolve('@storybook/builder-vite')),
      options: {
        ...(typeof framework === 'string' ? {} : framework.options.builder || {}),
      },
    },
    renderer: fileURLToPath(import.meta.resolve('@storybook/react/preset')),
  };
};

export const previewAnnotations: PresetProperty<'previewAnnotations'> = (entry = []) => {
  return [
    ...entry,
    fileURLToPath(import.meta.resolve('@storybook/experimental-nextjs-vite/preview')),
  ];
};

export const viteFinal: StorybookConfigVite['viteFinal'] = async (config, options) => {
  config.plugins = config.plugins || [];
  const { nextConfigPath } = await options.presets.apply<FrameworkOptions>('frameworkOptions');

  const nextDir = nextConfigPath ? path.dirname(nextConfigPath) : undefined;
  config.plugins.push(vitePluginStorybookNextjs({ dir: nextDir }));

  return config;
};
