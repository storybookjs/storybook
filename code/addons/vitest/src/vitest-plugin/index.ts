import type { Plugin } from 'vitest/config';

import { optionalEnvToBoolean } from '@storybook/core/internal/common';
// The product factory adds the common addon, legacy presets and built-in feature annotations.
import { createStorybook } from 'storybook/internal/instance';

import { vitePreviewPlugins } from '@storybook/builder-vite/node';

import { WORKING_DIR, isAddonDocsDisabled, resolveConfigDir, vitestAddon } from './addon.ts';
import type { UserOptions } from './types.ts';

export const storybookTest = async (options?: UserOptions): Promise<Plugin[]> => {
  if (!optionalEnvToBoolean(process.env.VITEST)) {
    return [];
  }
  const storybook = createStorybook({
    configDir: resolveConfigDir(options),
    workingDir: WORKING_DIR,
    mode: 'headless',
    // Tests need neither builder docgen nor, by default, MDX.
    overrides: {
      docs: { builderDocgen: false, ...(isAddonDocsDisabled(options) ? { mdx: false } : {}) },
    },
  });
  storybook.addAddon(vitestAddon(options));
  await storybook.ready();
  try {
    return (await vitePreviewPlugins(storybook)) as Plugin[];
  } catch (error) {
    await storybook.close();
    throw error;
  }
};

export default storybookTest;
