import { getAddonNames } from 'storybook/internal/common';

import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import { updateMainConfig } from '../helpers/mainConfigFile';
import type { Fix } from '../types';

interface AddonMdxGfmOptions {
  hasMdxGfm: boolean;
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
      let hasMdxGfm = false;

      await updateMainConfig({ mainConfigPath, dryRun: true }, () => {
        const addonNames = getAddonNames(mainConfig);
        hasMdxGfm = addonNames.includes('@storybook/addon-mdx-gfm');
      });

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

  async run({ result, dryRun, packageManager, mainConfigPath }) {
    const { hasMdxGfm } = result;

    if (!hasMdxGfm) {
      return;
    }

    await updateMainConfig({ mainConfigPath, dryRun: !!dryRun }, async (main) => {
      // Get the current addons array
      const addons = main.getFieldValue(['addons']) || [];

      // Find the mdx-gfm entry
      const mdxGfmIndex = addons.findIndex((addon: any) => {
        if (typeof addon === 'string') {
          return addon.includes('@storybook/addon-mdx-gfm');
        }
        return addon?.name.includes('@storybook/addon-mdx-gfm');
      });

      // Remove the mdx-gfm entry completely
      if (mdxGfmIndex !== -1) {
        main.removeField(['addons', mdxGfmIndex]);
      }
    });

    if (!dryRun) {
      // Remove addon-mdx-gfm package
      await packageManager.removeDependencies({}, ['@storybook/addon-mdx-gfm']);
    }
  },
};
