import { getAddonNames } from 'storybook/internal/common';
import { prompt } from 'storybook/internal/node-logger';

import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import type { Fix } from '../types';

/** Remove @storybook/addon-interactions since it's now part of Storybook core. */
export const removeAddonInteractions: Fix<{}> = {
  id: 'removeAddonInteractions',
  versionRange: ['<9.0.0', '^9.0.0-0 || ^9.0.0'],

  async check({ mainConfig }) {
    const addons = getAddonNames(mainConfig);
    const hasInteractionsAddon = addons.some((addon) =>
      addon.includes('@storybook/addon-interactions')
    );

    if (!hasInteractionsAddon) {
      return null;
    }

    return {};
  },

  prompt() {
    return dedent`
      ${picocolors.magenta('@storybook/addon-interactions')} has been consolidated into Storybook core.
      
      We'll remove it from your dependencies and unregister it from your Storybook configuration.
      The functionality will continue to work as before, but now it's built into Storybook core.
    `;
  },

  async run({ packageManager, dryRun, configDir }) {
    if (!dryRun) {
      await prompt.executeTaskWithSpinner(
        packageManager.runPackageCommand('storybook', [
          'remove',
          '@storybook/addon-interactions',
          '--config-dir',
          configDir,
          '--skip-install',
        ]),
        {
          intro: 'Removing @storybook/addon-interactions...',
          error: 'Failed to remove @storybook/addon-interactions',
          success: 'Removed @storybook/addon-interactions',
        }
      );
    }
  },
};
