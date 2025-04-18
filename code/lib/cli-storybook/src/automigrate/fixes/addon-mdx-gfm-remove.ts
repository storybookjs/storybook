import { getAddonNames } from 'storybook/internal/common';

import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

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
    return dedent`
      We've detected that you have ${picocolors.yellow('@storybook/addon-mdx-gfm')} installed.
      
      This package has been removed in Storybook 9.0. We'll remove it from your configuration and dependencies.
    `;
  },

  async run({ packageManager }) {
    await packageManager.runPackageCommand('storybook', ['remove', '@storybook/addon-mdx-gfm']);
  },
};
