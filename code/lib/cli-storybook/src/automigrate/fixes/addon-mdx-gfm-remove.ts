import { getAddonNames, removeAddon } from 'storybook/internal/common';

import picocolors from 'picocolors';

import type { Fix } from '../types';

interface AddonMdxGfmOptions {
  hasMdxGfm: true;
}

/**
 * Migration to handle @storybook/addon-mdx-gfm being removed
 *
 * - Remove @storybook/addon-mdx-gfm from main.ts and package.json
 */
export const addonMdxGfmRemove: Fix<AddonMdxGfmOptions> = {
  id: 'addon-mdx-gfm-remove',
  versionRange: ['<9.0.0', '^9.0.0-0 || ^9.0.0'],
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#mdx-gfm-addon-removed',

  async check({ mainConfigPath, mainConfig }) {
    if (!mainConfigPath) {
      return null;
    }

    try {
      const addonNames = getAddonNames(mainConfig);
      const hasMdxGfm = addonNames.includes('@storybook/addon-mdx-gfm');

      if (!hasMdxGfm) {
        return null;
      }

      return {
        hasMdxGfm,
      };
    } catch (err) {
      return null;
    }
  },

  prompt() {
    return `We'll remove ${picocolors.yellow('@storybook/addon-mdx-gfm')} as it's no longer needed in Storybook 9.0.`;
  },

  async run({ packageManager, configDir }) {
    await removeAddon('@storybook/addon-mdx-gfm', {
      configDir,
      skipInstall: true,
      packageManager,
    });
  },
};
