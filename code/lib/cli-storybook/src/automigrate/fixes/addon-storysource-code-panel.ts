import { getAddonNames, removeAddon } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import { add } from '../../add';
import { updateMainConfig } from '../helpers/mainConfigFile';
import type { Fix, RunOptions } from '../types';

export interface StorysourceOptions {
  hasStorysource: boolean;
  hasDocs: boolean;
}

export const addonStorysourceCodePanel: Fix<StorysourceOptions> = {
  id: 'addon-storysource-code-panel',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#storysource-addon-removed',

  async check({ mainConfigPath, mainConfig }) {
    if (!mainConfigPath) {
      return null;
    }

    const addonNames = getAddonNames(mainConfig);
    const hasStorysource = addonNames.includes('@storybook/addon-storysource');
    const hasDocs = addonNames.includes('@storybook/addon-docs');

    if (!hasStorysource) {
      return null;
    }

    return {
      hasStorysource,
      hasDocs,
    };
  },

  prompt: () => {
    return dedent`
      We'll remove @storybook/addon-storysource and enable the Code Panel instead.
    `;
  },

  run: async (options: RunOptions<StorysourceOptions>) => {
    const { result, dryRun = false, packageManager, configDir, previewConfigPath } = options;
    const { hasStorysource, hasDocs } = result;
    const errors: Array<{ file: string; error: Error }> = [];

    if (!hasStorysource) {
      return;
    }

    // Remove the addon
    if (!dryRun) {
      logger.debug('Removing @storybook/addon-storysource...');

      await removeAddon('@storybook/addon-storysource', {
        configDir,
        skipInstall: true,
        packageManager,
      });

      if (!hasDocs) {
        logger.log('Installing @storybook/addon-docs...');

        await add(`@storybook/addon-docs`, {
          configDir,
          packageManager: packageManager.type,
          skipInstall: true,
          skipPostinstall: true,
          yes: true,
        });
      }

      // Update preview config to enable code panel
      if (previewConfigPath) {
        try {
          await updateMainConfig({ mainConfigPath: previewConfigPath, dryRun }, (previewConfig) => {
            previewConfig.setFieldValue(['parameters', 'docs', 'codePanel'], true);
          });
        } catch (error) {
          console.log(error);
          errors.push({ file: previewConfigPath, error: error as Error });
        }
      } else {
        logger.log('No preview config file found. Please manually add code panel parameters.');
        logger.log(dedent`
          Add this to your .storybook/preview.js:
          export const parameters = {
            docs: {
              codePanel: true,
            },
          };`);
      }
    }

    if (errors.length > 0) {
      // eslint-disable-next-line local-rules/no-uncategorized-errors
      throw new Error(
        `Failed to process ${errors.length} files:\n${errors
          .map(({ file, error }) => `- ${file}: ${error.message}`)
          .join('\n')}`
      );
    }
  },
};
