import { getAddonNames, removeAddon } from 'storybook/internal/common';

import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import type { Fix } from '../types';

/** Remove @storybook/addon-interactions since it's now part of Storybook core. */
export const removeAddonInteractions: Fix<{}> = {
  id: 'removeAddonInteractions',
  versionRange: ['<9.0.0', '^9.0.0-0 || ^9.0.0'],
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#essentials-addon-viewport-controls-interactions-and-actions-moved-to-core',

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
      ${picocolors.magenta('@storybook/addon-interactions')} has been moved to Storybook core and will be removed from your configuration.
    `;
  },

  async run({ packageManager, dryRun, configDir }) {
    if (!dryRun) {
      removeAddon('@storybook/addon-interactions', {
        configDir,
        skipInstall: true,
        packageManager,
      });
    }
  },
};
