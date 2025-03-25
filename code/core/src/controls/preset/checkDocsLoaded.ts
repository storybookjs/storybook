import { isAbsolute, join } from 'node:path';

import { checkAddonOrder, serverRequire } from 'storybook/internal/common';

export const checkDocsLoaded = (configDir: string) => {
  checkAddonOrder({
    before: {
      name: '@storybook/addon-docs',
      inEssentials: true,
    },
    after: {
      name: '@storybook/addon-controls',
      inEssentials: true,
    },
    configFile: isAbsolute(configDir)
      ? join(configDir, 'main')
      : join(process.cwd(), configDir, 'main'),
    getConfig: (configFile) => serverRequire(configFile),
  });
};
