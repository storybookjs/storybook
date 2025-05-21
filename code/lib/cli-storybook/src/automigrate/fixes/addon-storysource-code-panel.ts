import { getAddonNames } from 'storybook/internal/common';

import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import { updateMainConfig } from '../helpers/mainConfigFile';
import type { Fix, RunOptions } from '../types';

export interface StorysourceOptions {
  hasStorysource: boolean;
  hasDocs: boolean;
}

const logger = console;

export const addonStorysourceCodePanel: Fix<StorysourceOptions> = {
  id: 'addon-storysource-code-panel',
  versionRange: ['<9.0.0', '^9.0.0-0 || ^9.0.0'],

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

  prompt: ({ hasDocs }) => {
    return dedent`
      We've detected that you're using ${picocolors.yellow('@storybook/addon-storysource')}.
      
      The ${picocolors.yellow('@storybook/addon-storysource')} addon is being removed in Storybook 9.0. 
      Instead, Storybook now provides a Code Panel via ${picocolors.yellow('@storybook/addon-docs')} 
      that offers similar functionality with improved integration and performance.
      
      We'll remove ${picocolors.yellow('@storybook/addon-storysource')} from your project and 
      enable the Code Panel in your preview configuration. ${
        hasDocs
          ? ''
          : `Additionally, we will install ${picocolors.yellow('@storybook/addon-docs')} for you.`
      }
      
      More info: ${picocolors.cyan('https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#storysource-addon-removed')}
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
      logger.log('Removing @storybook/addon-storysource...');

      await packageManager.runPackageCommand('storybook', [
        'remove',
        '@storybook/addon-storysource',
        '--config-dir',
        configDir,
      ]);

      if (!hasDocs) {
        logger.log('Installing @storybook/addon-docs...');

        await packageManager.runPackageCommand('storybook', [
          'add',
          '@storybook/addon-docs',
          '--config-dir',
          configDir,
        ]);
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
