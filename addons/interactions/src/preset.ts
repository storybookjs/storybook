import { isAbsolute, join } from 'node:path';

import { checkAddonOrder, serverRequire } from 'storybook/internal/common';

export const checkActionsLoaded = (configDir: string) => {
  checkAddonOrder({
    before: {
      name: '@storybook/addon-actions',
      inEssentials: true,
    },
    after: {
      name: '@storybook/addon-interactions',
      inEssentials: false,
    },
    configFile: isAbsolute(configDir)
      ? join(configDir, 'main')
      : join(process.cwd(), configDir, 'main'),
    getConfig: (configFile) => serverRequire(configFile),
  });
};

// This annotation is read by addon-test, so it can throw an error if both addons are used
export const ADDON_INTERACTIONS_IN_USE = true;
