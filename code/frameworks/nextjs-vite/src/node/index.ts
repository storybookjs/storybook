import type { StorybookConfig } from '../types.ts';

export function defineMain(config: StorybookConfig) {
  return config;
}

export { experimental_vitePlugin } from '@storybook/builder-vite';
export type { experimental_VitePluginUserOptions } from '@storybook/builder-vite';
