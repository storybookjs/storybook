import { getAddonNames, removeAddon, transformImportFiles } from 'storybook/internal/common';

import { add } from '../../add';
import { updateMainConfig } from '../helpers/mainConfigFile';
import type { Fix } from '../types';
import { moveEssentialOptions } from './remove-essentials.utils';

interface AddonDocsOptions {
  hasEssentials: boolean;
  essentialsOptions?: Record<string, any>;
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
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#essentials-addon-viewport-controls-interactions-and-actions-moved-to-core',

  async check({ mainConfigPath, mainConfig, packageManager }) {
    if (!mainConfigPath) {
      return null;
    }

    try {
      let hasEssentialsAddon = false;
      let hasDocsAddon = false;
      let hasDocsDisabled = false;
      let essentialsOptions: Record<string, any> | undefined = undefined;
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

          const optionsExceptDocs = Object.fromEntries(
            Object.entries(options).filter(([key]) => key !== 'docs')
          );

          if (Object.keys(optionsExceptDocs).length > 0) {
            essentialsOptions = optionsExceptDocs;
          }
        }
      }

      if (!hasEssentialsAddon && additionalAddonsToRemove.length === 0) {
        return null;
      }

      const result: AddonDocsOptions = {
        hasEssentials: hasEssentialsAddon,
        hasDocsDisabled,
        hasDocsAddon,
        additionalAddonsToRemove,
        allDeps,
      };

      if (essentialsOptions) {
        result.essentialsOptions = essentialsOptions;
      }

      return result;
    } catch (err) {
      return null;
    }
  },

  prompt() {
    return "In Storybook 9.0, several addons have been moved into Storybook's core and are no longer needed as separate packages. We'll remove the unnecessary addons from your configuration and dependencies, and update your code to use the new core features.";
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
    const {
      hasEssentials,
      hasDocsDisabled,
      hasDocsAddon,
      additionalAddonsToRemove,
      essentialsOptions,
    } = result;

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

      if (essentialsOptions) {
        await updateMainConfig(
          { mainConfigPath, dryRun: !!dryRun },
          moveEssentialOptions(dryRun, essentialsOptions)
        );
      }

      // If docs was enabled (not disabled) and not already installed, add it
      if (!hasDocsDisabled && hasEssentials) {
        await add('@storybook/addon-docs', {
          configDir,
          packageManager: packageManager.type,
          skipInstall: true,
          skipPostinstall: true,
          yes: true,
        });
      }
    }
  },
};
