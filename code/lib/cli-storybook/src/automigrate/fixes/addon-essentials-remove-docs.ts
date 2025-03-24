import { getStorybookVersionSpecifier } from 'storybook/internal/cli';
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
 * Migration to handle @storybook/addon-docs being removed from @storybook/addon-essentials
 *
 * - If user has essentials with docs disabled: Remove the docs disabling config
 * - If user has essentials without docs disabled: Install @storybook/addon-docs and add to main.ts
 * - If user doesn't have essentials: Skip migration
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
    if (hasDocsDisabled) {
      return dedent`
        We've detected that you have ${picocolors.yellow('@storybook/addon-essentials')} with docs disabled.
        
        ${picocolors.yellow('@storybook/addon-docs')} has been removed from ${picocolors.yellow('@storybook/addon-essentials')}.
        We'll remove the docs disabling configuration since it's no longer needed.
      `;
    }

    return dedent`
      We've detected that you have ${picocolors.yellow('@storybook/addon-essentials')} with docs enabled.
      
      ${picocolors.yellow('@storybook/addon-docs')} has been removed from ${picocolors.yellow('@storybook/addon-essentials')}.
      We'll install ${picocolors.yellow('@storybook/addon-docs')} separately and add it to your configuration.
    `;
  },

  async run({ result, dryRun, packageManager, skipInstall = false, mainConfigPath }) {
    const { hasEssentials, hasDocsDisabled, hasDocsAddon } = result;

    if (!hasEssentials) {
      return;
    }

    await updateMainConfig({ mainConfigPath, dryRun: !!dryRun }, async (main) => {
      // Get the current addons array
      const addons = main.getFieldValue(['addons']) || [];

      // Find the essentials entry
      const essentialsIndex = addons.findIndex((addon: any) => {
        if (typeof addon === 'string') {
          return addon.includes('@storybook/addon-essentials');
        }
        return addon?.name.includes('@storybook/addon-essentials');
      });

      // Safety check: if essentials isn't found, we can't modify it
      if (essentialsIndex === -1) {
        return;
      }

      main.removeField(['addons', essentialsIndex, 'options', 'docs']);
    });

    if (!dryRun && !hasDocsDisabled && !hasDocsAddon) {
      await packageManager.runPackageCommand('storybook', ['add', '@storybook/addon-docs']);
    }
  },
};
