import { readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

import type { Channel } from 'storybook/internal/channels';
import { checkAddonOrder, getFrameworkName, serverRequire } from 'storybook/internal/common';
import {
  TESTING_MODULE_BOOT_REQUEST,
  TESTING_MODULE_RUN_ALL_REQUEST,
  TESTING_MODULE_RUN_REQUEST,
  TESTING_MODULE_WATCH_MODE_REQUEST,
} from 'storybook/internal/core-events';
import { oneWayHash, telemetry } from 'storybook/internal/telemetry';
import type { Options, StoryId } from 'storybook/internal/types';

import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import { STORYBOOK_ADDON_TEST_CHANNEL } from './constants';
import { log } from './logger';
import { runTestRunner } from './node/boot-test-runner';

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
type Event = {
  type: 'test-discrepancy';
  payload: {
    storyId: StoryId;
    browserStatus: 'PASS' | 'FAIL';
    cliStatus: 'FAIL' | 'PASS';
    message: string;
  };
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export const experimental_serverChannel = async (channel: Channel, options: Options) => {
  const core = await options.presets.apply('core');
  const builderName = typeof core?.builder === 'string' ? core.builder : core?.builder?.name;
  const framework = await getFrameworkName(options);

  // Only boot the test runner if the builder is vite, else just provide interactions functionality
  if (!builderName?.includes('vite')) {
    if (framework.includes('nextjs')) {
      log(dedent`
        You're using ${framework}, which is a Webpack-based builder. In order to use Storybook Test, with your project, you need to use '@storybook/experimental-nextjs-vite', a high performance Vite-based equivalent.

        Information on how to upgrade here: ${picocolors.yellow('https://storybook.js.org/docs/get-started/frameworks/nextjs#with-vite')}\n
      `);
    }

    return channel;
  }

  const execute =
    (eventName?: string) =>
    (...args: any[]) => {
      runTestRunner(channel, eventName, args);
    };

  channel.on(TESTING_MODULE_BOOT_REQUEST, execute());
  channel.on(TESTING_MODULE_RUN_ALL_REQUEST, execute(TESTING_MODULE_RUN_ALL_REQUEST));
  channel.on(TESTING_MODULE_RUN_REQUEST, execute(TESTING_MODULE_RUN_REQUEST));
  channel.on(TESTING_MODULE_WATCH_MODE_REQUEST, (payload) => {
    if (payload.watchMode) {
      execute(TESTING_MODULE_WATCH_MODE_REQUEST)(payload);
    }
  });

  if (!core.disableTelemetry) {
    const packageJsonPath = require.resolve('@storybook/experimental-addon-test/package.json');

    const { version: addonVersion } = JSON.parse(
      readFileSync(packageJsonPath, { encoding: 'utf-8' })
    );

    channel.on(STORYBOOK_ADDON_TEST_CHANNEL, (event: Event) => {
      // @ts-expect-error This telemetry is not a core one, so we don't have official types for it (similar to onboarding addon)
      telemetry('addon-test', {
        ...event,
        payload: {
          ...event.payload,
          storyId: oneWayHash(event.payload.storyId),
        },
        addonVersion,
      });
    });
  }

  return channel;
};
