import { isAbsolute, join } from 'node:path';

import { checkAddonOrder, serverRequire } from 'storybook/internal/common';

export function previewAnnotations(entry: string[] = [], options: { configDir: string }) {
  checkAddonOrder({
    before: {
      name: '@storybook/addon-actions',
      inEssentials: true,
    },
    after: {
      name: '@storybook/addon-interactions',
      inEssentials: false,
    },
    configFile: isAbsolute(options.configDir)
      ? join(options.configDir, 'main')
      : join(process.cwd(), options.configDir, 'main'),
    getConfig: (configFile) => serverRequire(configFile),
  });
  return entry;
}

// This annotation is read by addon-test, so it can throw an error if both addons are used
export const ADDON_INTERACTIONS_IN_USE = true;
