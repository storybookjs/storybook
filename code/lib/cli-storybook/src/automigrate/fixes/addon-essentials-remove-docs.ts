import { getAddonNames } from 'storybook/internal/common';

import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import { updateMainConfig } from '../helpers/mainConfigFile';
import type { Fix } from '../types';

interface AddonDocsOptions {
  hasEssentials: boolean;
  hasDocsDisabled: boolean;
  hasDocsAddon: boolean;
}

/**
 * Migration to handle @storybook/addon-essentials being removed and its features moving to core
 *
 * - Remove @storybook/addon-essentials from main.ts and package.json
 * - If user had docs enabled (default): Install @storybook/addon-docs and add to main.ts
 * - If user had docs disabled: Skip addon-docs installation
 */
export const addonEssentialsRemoveDocs: Fix<AddonDocsOptions> = {
  id: 'addon-essentials-remove-docs',
  versionRange: ['<9.0.0', '^9.0.0-0 || ^9.0.0'],

  async check({ mainConfigPath, mainConfig }) {
    if (!mainConfigPath) {
      return null;
    }

    try {
      let hasEssentialsAddon = false;
      let hasDocsAddon = false;
      let hasDocsDisabled = false;

      await updateMainConfig({ mainConfigPath, dryRun: true }, (main) => {
        const addons = main.getFieldValue(['addons']) || [];
        const addonNames = getAddonNames(mainConfig);

        // Check if essentials is present
        hasEssentialsAddon = addonNames.includes('@storybook/addon-essentials');
        hasDocsAddon = addonNames.includes('@storybook/addon-docs');

        if (hasEssentialsAddon) {
          // Find the essentials entry to check its configuration
          const essentialsEntry = addons.find((addon: any) => {
            if (typeof addon === 'string') {
              return addon.includes('@storybook/addon-essentials');
            }
            return addon?.name.includes('@storybook/addon-essentials');
          });

          // Check if docs is explicitly disabled in the options
          if (typeof essentialsEntry === 'object') {
            const options = essentialsEntry.options || {};
            hasDocsDisabled = options.docs === false;
          }
        }
      });

      if (!hasEssentialsAddon) {
        return null;
      }

      return {
        hasEssentials: hasEssentialsAddon,
        hasDocsDisabled,
        hasDocsAddon,
      };
    } catch (err) {
      return null;
    }
  },

  prompt({ hasDocsDisabled }) {
    const baseMessage = dedent`
      We've detected that you have ${picocolors.yellow('@storybook/addon-essentials')} installed.
      
      In Storybook 9.0, all features from ${picocolors.yellow('@storybook/addon-essentials')} (except docs) 
      have been moved into Storybook's core. You no longer need to install or configure them separately.
      
      We'll remove ${picocolors.yellow('@storybook/addon-essentials')} from your configuration and dependencies.
    `;

    if (hasDocsDisabled) {
      return baseMessage;
    }

    return dedent`
      ${baseMessage}
      
      Since you were using the docs feature, we'll install ${picocolors.yellow('@storybook/addon-docs')} 
      separately and add it to your configuration.
    `;
  },

  async run({ result, dryRun, packageManager, mainConfigPath }) {
    const { hasEssentials, hasDocsDisabled, hasDocsAddon } = result;

    if (!hasEssentials) {
      return;
    }

    if (!dryRun) {
      // Remove addon-essentials package
      await packageManager.runPackageCommand('storybook', [
        'remove',
        '@storybook/addon-essentials',
      ]);

      // If docs was enabled (not disabled) and not already installed, add it
      if (!hasDocsDisabled && !hasDocsAddon) {
        await packageManager.runPackageCommand('storybook', ['add', '@storybook/addon-docs']);
      }
    }
  },
};
