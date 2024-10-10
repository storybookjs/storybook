import { isAbsolute, join } from 'node:path';

import type { Channel } from 'storybook/internal/channels';
import { checkAddonOrder, serverRequire } from 'storybook/internal/common';
import {
  TESTING_MODULE_RUN_ALL_REQUEST,
  TESTING_MODULE_RUN_REQUEST,
  TESTING_MODULE_WATCH_MODE_REQUEST,
} from 'storybook/internal/core-events';
import type { Options } from 'storybook/internal/types';

import { bootTestRunner } from './node/boot-test-runner';

export const checkActionsLoaded = (configDir: string) => {
  checkAddonOrder({
    before: {
      name: '@storybook/addon-actions',
      inEssentials: true,
    },
    after: {
      name: '@storybook/experimental-addon-test',
      inEssentials: false,
    },
    configFile: isAbsolute(configDir)
      ? join(configDir, 'main')
      : join(process.cwd(), configDir, 'main'),
    getConfig: (configFile) => serverRequire(configFile),
  });
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export const experimental_serverChannel = async (channel: Channel, options: Options) => {
  const core = await options.presets.apply('core');
  const builderName = typeof core?.builder === 'string' ? core.builder : core?.builder?.name;
  // Only boot the test runner if the builder is vite, else just provide interactions functionality
  if (!builderName?.includes('vite')) {
    return channel;
  }

  let booting = false;
  let booted = false;
  const start =
    (eventName: string) =>
    (...args: any[]) => {
      if (!booted && !booting) {
        booting = true;
        bootTestRunner(channel, eventName, args)
          .then(() => {
            booted = true;
          })
          .catch(() => {
            booted = false;
          })
          .finally(() => {
            booting = false;
          });
      }
    };

  channel.on(TESTING_MODULE_RUN_ALL_REQUEST, start(TESTING_MODULE_RUN_ALL_REQUEST));
  channel.on(TESTING_MODULE_RUN_REQUEST, start(TESTING_MODULE_RUN_REQUEST));
  channel.on(TESTING_MODULE_WATCH_MODE_REQUEST, (payload) => {
    if (payload.watchMode) {
      start(TESTING_MODULE_WATCH_MODE_REQUEST)(payload);
    }
  });

  return channel;
};
