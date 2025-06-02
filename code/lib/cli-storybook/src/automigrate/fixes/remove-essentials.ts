import { getAddonNames, removeAddon, transformImportFiles } from 'storybook/internal/common';

import { dedent } from 'ts-dedent';

import { add } from '../../add';
import type { Fix } from '../types';

interface AddonDocsOptions {
  hasEssentials: boolean;
  hasDocsDisabled: boolean;
  hasDocsAddon: boolean;
  additionalAddonsToRemove: string[];
  allDeps: Record<string, string>;
}

const consolidatedAddons = {
  '@storybook/addon-actions': 'storybook/actions',
  '@storybook/addon-controls': 'storybook/internal/controls',
  '@storybook/addon-toolbars': 'storybook/internal/toolbars',
  '@storybook/addon-highlight': 'storybook/highlight',
  '@storybook/addon-measure': 'storybook/measure',
  '@storybook/addon-outline': 'storybook/outline',
  '@storybook/addon-backgrounds': 'storybook/backgrounds',
  '@storybook/addon-viewport': 'storybook/viewport',
};

/**
 * Migration to handle @storybook/addon-essentials being removed and its features moving to core
 *
 * - Remove @storybook/addon-essentials from main.ts and package.json
 * - If user had docs enabled (default): Install @storybook/addon-docs and add to main.ts
 * - If user had docs disabled: Skip addon-docs installation
 */
export const removeEssentials: Fix<AddonDocsOptions> = {
  id: 'remove-essential-addons',
  versionRange: ['<9.0.0', '^9.0.0-0 || ^9.0.0'],
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#essentials-addon-viewport-controls-interactions-and-actions-moved-to-core',

  async check({ mainConfigPath, mainConfig, packageManager }) {
    if (!mainConfigPath) {
      return null;
    }

    try {
      let hasEssentialsAddon = false;
      let hasDocsAddon = false;
      let hasDocsDisabled = false;
      const additionalAddonsToRemove: string[] = [];

      const CORE_ADDONS = [
        '@storybook/addon-actions',
        '@storybook/addon-backgrounds',
        '@storybook/addon-controls',
        '@storybook/addon-highlight',
        '@storybook/addon-measure',
        '@storybook/addon-outline',
        '@storybook/addon-toolbars',
        '@storybook/addon-viewport',
      ];

      const addonNames = getAddonNames(mainConfig);

      // Check if essentials is present
      hasEssentialsAddon = addonNames.includes('@storybook/addon-essentials');
      hasDocsAddon = addonNames.includes('@storybook/addon-docs');

      const allDeps = packageManager.getAllDependencies();

      const installedAddons = Object.keys(allDeps);

      // Check for additional addons that need to be removed
      for (const addon of CORE_ADDONS) {
        if (addonNames.includes(addon) || installedAddons.includes(addon)) {
          additionalAddonsToRemove.push(addon);
        }
      }

      if (hasEssentialsAddon) {
        // Find the essentials entry to check its configuration
        const essentialsEntry = mainConfig.addons?.find((addon) => {
          if (typeof addon === 'string') {
            return addon.includes('@storybook/addon-essentials');
          }
          return addon.name.includes('@storybook/addon-essentials');
        });

        // Check if docs is explicitly disabled in the options
        if (typeof essentialsEntry === 'object') {
          const options = essentialsEntry.options || {};
          hasDocsDisabled = options.docs === false;
        }
      }

      if (!hasEssentialsAddon && additionalAddonsToRemove.length === 0) {
        return null;
      }

      return {
        hasEssentials: hasEssentialsAddon,
        hasDocsDisabled,
        hasDocsAddon,
        additionalAddonsToRemove,
        allDeps,
      };
    } catch (err) {
      return null;
    }
  },

  prompt() {
    return dedent`
      In Storybook 9.0, several addons have been moved into Storybook's core and are no longer needed as separate packages.
      
      We'll remove the unnecessary addons from your configuration and dependencies, and update your code to use the new core features.
    `;
  },

  async run({
    result,
    dryRun,
    packageManager,
    configDir,
    storybookVersion,
    storiesPaths,
    mainConfigPath,
    previewConfigPath,
  }) {
    const { hasEssentials, hasDocsDisabled, hasDocsAddon, additionalAddonsToRemove } = result;

    if (!hasEssentials && additionalAddonsToRemove.length === 0) {
      return;
    }

    if (!dryRun) {
      // Remove addon-essentials package if present
      if (hasEssentials) {
        await removeAddon('@storybook/addon-essentials', {
          configDir,
          packageManager,
          skipInstall: true,
        });
      }

      // Remove additional core addons
      for (const addon of additionalAddonsToRemove) {
        await removeAddon(addon, {
          configDir,
          packageManager,
          skipInstall: true,
        });
      }

      const errors = await transformImportFiles(
        [...storiesPaths, mainConfigPath, previewConfigPath].filter(Boolean) as string[],
        consolidatedAddons,
        dryRun
      );

      if (errors.length > 0) {
        // eslint-disable-next-line local-rules/no-uncategorized-errors
        throw new Error(
          `Failed to process ${errors.length} files:\n${errors
            .map(({ file, error }) => `- ${file}: ${error.message}`)
            .join('\n')}`
        );
      }

      // If docs was enabled (not disabled) and not already installed, add it
      if (!hasDocsDisabled && hasEssentials) {
        if (!hasDocsAddon) {
          await add(`@storybook/addon-docs@${storybookVersion}`, {
            configDir,
            packageManager: packageManager.type,
            skipInstall: true,
            skipPostinstall: true,
          });
        } else {
          const isDocsInstalled = await packageManager.getInstalledVersion('@storybook/addon-docs');

          if (!isDocsInstalled) {
            await packageManager.addDependencies(
              { installAsDevDependencies: true, skipInstall: true },
              ['@storybook/addon-docs@' + storybookVersion]
            );
          }
        }
      }
    }
  },
};
