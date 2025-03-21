import { getStorybookVersionSpecifier } from 'storybook/internal/cli';

import { dedent } from 'ts-dedent';

import { updateMainConfig } from '../helpers/mainConfigFile';
import type { Fix } from '../types';

interface AddonDocsOptions {
  hasEssentials: boolean;
  hasDocsDisabled: boolean;
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

  async check({ mainConfigPath }) {
    if (!mainConfigPath) {
      return null;
    }

    try {
      let hasEssentials = false;
      let hasDocsDisabled = false;

      await updateMainConfig({ mainConfigPath, dryRun: true }, (main) => {
        const addons = main.getFieldValue(['addons']) || [];

        // Find the essentials entry and check its configuration
        const essentialsEntry = addons.find((addon: any) => {
          if (typeof addon === 'string') {
            return addon === '@storybook/addon-essentials';
          }
          return addon?.name === '@storybook/addon-essentials';
        });

        if (essentialsEntry) {
          hasEssentials = true;
          // Check if docs is explicitly disabled in the options
          if (typeof essentialsEntry === 'object') {
            const options = essentialsEntry.options || {};
            hasDocsDisabled = options.docs === false;
          }
        }
      });

      if (!hasEssentials) {
        return null;
      }

      return {
        hasEssentials,
        hasDocsDisabled,
      };
    } catch (err) {
      return null;
    }
  },

  prompt({ hasDocsDisabled }) {
    if (hasDocsDisabled) {
      return dedent`
        We've detected that you have @storybook/addon-essentials with docs disabled.
        
        @storybook/addon-docs has been removed from @storybook/addon-essentials.
        We'll remove the docs disabling configuration since it's no longer needed.
      `;
    }

    return dedent`
      We've detected that you have @storybook/addon-essentials with docs enabled.
      
      @storybook/addon-docs has been removed from @storybook/addon-essentials.
      We'll install @storybook/addon-docs separately and add it to your configuration.
    `;
  },

  async run({ result, dryRun, packageManager, skipInstall = false, mainConfigPath }) {
    const { hasDocsDisabled } = result;

    await updateMainConfig({ mainConfigPath, dryRun: !!dryRun }, async (main) => {
      // Get the current addons array
      const addons = main.getFieldValue(['addons']) || [];

      // Find the essentials entry
      const essentialsIndex = addons.findIndex((addon: any) => {
        if (typeof addon === 'string') {
          return addon === '@storybook/addon-essentials';
        }
        return addon?.name === '@storybook/addon-essentials';
      });

      // Safety check: if essentials isn't found, we can't modify it
      if (essentialsIndex === -1) {
        return;
      }

      if (hasDocsDisabled) {
        // If docs was disabled, simply remove the docs config from essentials
        if (typeof addons[essentialsIndex] === 'object') {
          const options = addons[essentialsIndex].options || {};
          delete options.docs;

          // If options is now empty, convert back to string format
          if (Object.keys(options).length === 0) {
            addons[essentialsIndex] = '@storybook/addon-essentials';
          } else {
            addons[essentialsIndex].options = options;
          }
        }
      } else {
        // If docs was enabled, add @storybook/addon-docs as a separate addon
        if (!dryRun) {
          const versionToInstall = getStorybookVersionSpecifier(
            await packageManager.retrievePackageJson()
          );

          // Install @storybook/addon-docs
          await packageManager.addDependencies({ installAsDevDependencies: true, skipInstall }, [
            `@storybook/addon-docs@${versionToInstall}`,
          ]);

          // Add @storybook/addon-docs to the addons array
          main.appendValueToArray(['addons'], '@storybook/addon-docs');
        }
      }

      // Update the addons array
      main.setFieldValue(['addons'], addons);
    });
  },
};
