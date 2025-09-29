import { getAddonNames, removeAddon } from 'storybook/internal/common';

import type { Fix } from '../types';

type AddonMdxGfmOptions = true;

/**
 * Migration to handle @storybook/addon-mdx-gfm being removed
 *
 * - Remove @storybook/addon-mdx-gfm from main.ts and package.json
 */
export const addonMdxGfmRemove: Fix<AddonMdxGfmOptions> = {
  id: 'addon-mdx-gfm-remove',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#mdx-gfm-addon-removed',

  async check({ mainConfigPath, mainConfig, packageManager }) {
    if (!mainConfigPath) {
      return null;
    }

    try {
      const addonName = '@storybook/addon-mdx-gfm';
      const addonNames = getAddonNames(mainConfig);
      const hasMdxGfm = addonNames.includes(addonName);
      const hasMdxGfmInDeps = packageManager.isDependencyInstalled(addonName);

      if (!hasMdxGfm && !hasMdxGfmInDeps) {
        return null;
      }

      return true;
    } catch (err) {
      return null;
    }
  },

  prompt() {
    return `We'll remove @storybook/addon-mdx-gfm as it's no longer needed in Storybook 9.0.`;
  },

  async run({ packageManager, configDir }) {
    await removeAddon('@storybook/addon-mdx-gfm', {
      configDir,
      skipInstall: true,
      packageManager,
    });
  },
};
