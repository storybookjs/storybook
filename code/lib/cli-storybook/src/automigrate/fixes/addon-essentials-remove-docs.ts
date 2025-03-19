import { readFile } from 'node:fs/promises';

import { getStorybookVersionSpecifier } from 'storybook/internal/cli';

import { dedent } from 'ts-dedent';

import { updateMainConfig } from '../helpers/mainConfigFile';
import type { Fix } from '../types';

interface AddonDocsOptions {
  mainConfigPath: string;
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
      const mainConfig = await readFile(mainConfigPath, 'utf-8');

      // Check if addon-essentials is present
      const hasEssentials = mainConfig.includes('@storybook/addon-essentials');
      if (!hasEssentials) {
        return null;
      }

      // Check if docs is disabled in essentials config
      const hasDocsDisabled =
        mainConfig.includes('"docs": false') ||
        mainConfig.includes("'docs': false") ||
        mainConfig.includes('docs:false');

      return {
        mainConfigPath,
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

  async run({ result, dryRun, packageManager, skipInstall = false }) {
    const { mainConfigPath, hasDocsDisabled } = result;

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
