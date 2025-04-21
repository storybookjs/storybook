import { commonGlobOptions, getAddonNames, getProjectRoot } from 'storybook/internal/common';

import picocolors from 'picocolors';
import prompts from 'prompts';
import { dedent } from 'ts-dedent';

import { updateMainConfig } from '../helpers/mainConfigFile';
import { transformImportFiles } from '../helpers/transformImports';
import type { Fix } from '../types';

interface AddonDocsOptions {
  hasEssentials: boolean;
  hasDocsDisabled: boolean;
  hasDocsAddon: boolean;
  additionalAddonsToRemove: string[];
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
export const addonEssentialsRemoveDocs: Fix<AddonDocsOptions> = {
  id: 'addon-essentials-remove-docs',
  versionRange: ['<9.0.0', '^9.0.0-0 || ^9.0.0'],

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

      await updateMainConfig({ mainConfigPath, dryRun: true }, async (main) => {
        const addons = main.getFieldValue(['addons']) || [];
        const addonNames = getAddonNames(mainConfig);

        // Check if essentials is present
        hasEssentialsAddon = addonNames.includes('@storybook/addon-essentials');
        hasDocsAddon = addonNames.includes('@storybook/addon-docs');

        const packageJson = await packageManager.retrievePackageJson();
        const installedAddons = Object.keys({
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        });

        // Check for additional addons that need to be removed
        for (const addon of CORE_ADDONS) {
          if (addonNames.includes(addon) || installedAddons.includes(addon)) {
            additionalAddonsToRemove.push(addon);
          }
        }

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

      if (!hasEssentialsAddon && additionalAddonsToRemove.length === 0) {
        return null;
      }

      return {
        hasEssentials: hasEssentialsAddon,
        hasDocsDisabled,
        hasDocsAddon,
        additionalAddonsToRemove,
      };
    } catch (err) {
      return null;
    }
  },

  prompt({ hasDocsDisabled, additionalAddonsToRemove, hasEssentials }) {
    let message = '';

    if (hasEssentials) {
      message = dedent`
        We've detected that you have ${picocolors.yellow('@storybook/addon-essentials')} installed.
        
        In Storybook 9.0, all features from ${picocolors.yellow('@storybook/addon-essentials')} (except docs) 
        have been moved into Storybook's core. You no longer need to install or configure them separately.
        
        We'll remove ${picocolors.yellow('@storybook/addon-essentials')} from your configuration and dependencies.
      `;
    }

    const additionalAddonsMessage =
      additionalAddonsToRemove.length > 0
        ? dedent`
        ${hasEssentials ? '' : "In Storybook 9.0, several features have been moved into Storybook's core."}\n\nWe've detected the following addons that are now part of Storybook core:
        ${additionalAddonsToRemove.map((addon) => `\n- ${picocolors.yellow(addon)}`).join('')}
        
        These will be removed as they are no longer needed.
        
        We'll also need to update your code to use the new core addons.`
        : '';

    if (hasDocsDisabled) {
      return `${message}${additionalAddonsMessage}`;
    }

    if (!hasEssentials) {
      return additionalAddonsMessage;
    }

    return dedent`
      ${message}${additionalAddonsMessage}
      
      Since you were using the docs feature, we'll install ${picocolors.yellow('@storybook/addon-docs')} 
      separately and add it to your configuration.
    `;
  },

  async run({ result, dryRun, packageManager }) {
    const { hasEssentials, hasDocsDisabled, hasDocsAddon, additionalAddonsToRemove } = result;

    if (!hasEssentials && additionalAddonsToRemove.length === 0) {
      return;
    }

    if (!dryRun) {
      // Remove addon-essentials package if present
      if (hasEssentials) {
        console.log('Removing @storybook/addon-essentials...');

        await packageManager.runPackageCommand('storybook', [
          'remove',
          '@storybook/addon-essentials',
        ]);
      }

      // Remove additional core addons
      for (const addon of additionalAddonsToRemove) {
        await packageManager.runPackageCommand('storybook', ['remove', addon]);
      }

      if (additionalAddonsToRemove.length) {
        const projectRoot = getProjectRoot();
        const errors: Array<{ file: string; error: Error }> = [];
        const defaultGlob = '**/*.{mjs,cjs,js,jsx,ts,tsx,mdx}';
        // Find all files matching the glob pattern
        console.log('Scanning for affected files...');
        const { glob } = await prompts({
          type: 'text',
          name: 'glob',
          message: 'Enter a custom glob pattern to scan (or press enter to use default):',
          initial: defaultGlob,
        });

        // eslint-disable-next-line depend/ban-dependencies
        const globby = (await import('globby')).globby;

        const sourceFiles = await globby([glob], {
          ...commonGlobOptions(''),
          ignore: ['**/node_modules/**'],
          dot: true,
          cwd: projectRoot,
          absolute: true,
        });

        console.log(`Scanning ${sourceFiles.length} files...`);

        const importErrors = await transformImportFiles(sourceFiles, consolidatedAddons, dryRun);
        errors.push(...importErrors);

        if (errors.length > 0) {
          // eslint-disable-next-line local-rules/no-uncategorized-errors
          throw new Error(
            `Failed to process ${errors.length} files:\n${errors
              .map(({ file, error }) => `- ${file}: ${error.message}`)
              .join('\n')}`
          );
        }
      }

      // If docs was enabled (not disabled) and not already installed, add it
      if (!hasDocsDisabled && !hasDocsAddon) {
        console.log('Adding @storybook/addon-docs...');
        await packageManager.runPackageCommand('storybook', ['add', '@storybook/addon-docs']);
      }
    }
  },
};
