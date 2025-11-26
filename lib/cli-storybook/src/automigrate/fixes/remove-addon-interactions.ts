import { getAddonNames, removeAddon } from 'storybook/internal/common';

import type { Fix } from '../types';

/** Remove @storybook/addon-interactions since it's now part of Storybook core. */
export const removeAddonInteractions: Fix<true> = {
  id: 'remove-addon-interactions',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#essentials-addon-viewport-controls-interactions-and-actions-moved-to-core',

  async check({ mainConfig, packageManager }) {
    const addons = getAddonNames(mainConfig);
    const interactionsAddon = '@storybook/addon-interactions';

    const hasInteractionsAddon = addons.some((addon) => addon.includes(interactionsAddon));
    const hasInteractionsAddonInDeps = packageManager.isDependencyInstalled(interactionsAddon);

    if (!hasInteractionsAddon && !hasInteractionsAddonInDeps) {
      return null;
    }

    return true;
  },

  prompt() {
    return '@storybook/addon-interactions has been moved to Storybook core and will be removed from your configuration.';
  },

  async run({ packageManager, dryRun, configDir }) {
    if (!dryRun) {
      await removeAddon('@storybook/addon-interactions', {
        configDir,
        skipInstall: true,
        packageManager,
      });
    }
  },
};
