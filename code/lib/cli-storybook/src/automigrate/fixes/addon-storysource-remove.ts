import { getAddonNames } from 'storybook/internal/common';

import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import { updateMainConfig } from '../helpers/mainConfigFile';
import type { Fix } from '../types';

interface AddonStorysourceOptions {
  hasStorysource: true;
}

/**
 * Migration to handle @storybook/addon-storysource being removed
 *
 * - Remove @storybook/addon-storysource from main.ts and package.json
 */
export const addonStorysourceRemove: Fix<AddonStorysourceOptions, 'addon-storysource-remove'> = {
  id: 'addon-storysource-remove',
  versionRange: ['<9.0.0', '^9.0.0-0 || ^9.0.0'],

  async check({ mainConfigPath, mainConfig }) {
    if (!mainConfigPath) {
      return null;
    }

    try {
      let hasStorysource = false;

      await updateMainConfig({ mainConfigPath, dryRun: true }, () => {
        const addonNames = getAddonNames(mainConfig);
        hasStorysource = addonNames.includes('@storybook/addon-storysource');
      });

      if (!hasStorysource) {
        return null;
      }

      return {
        hasStorysource,
      };
    } catch (err) {
      return null;
    }
  },

  prompt() {
    return dedent`
      We've detected that you have ${picocolors.yellow('@storybook/addon-storysource')} installed.
      
      This package has been removed in Storybook 9.0. We'll remove it from your configuration and dependencies.

      For more information, see the migration guide:
      https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#storysource-addon-removed
    `;
  },

  async run({ configDir, packageManager }) {
    await packageManager.runPackageCommand('storybook', [
      'remove',
      '@storybook/addon-storysource',
      '--config-dir',
      configDir,
    ]);
  },
};
