import { readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';

import type { Channel } from 'storybook/internal/channels';
import {
  checkAddonOrder,
  getFrameworkName,
  resolvePathInStorybookCache,
  serverRequire,
} from 'storybook/internal/common';
import {
  TESTING_MODULE_CRASH_REPORT,
  TESTING_MODULE_PROGRESS_REPORT,
  TESTING_MODULE_RUN_REQUEST,
  type TestingModuleCrashReportPayload,
  type TestingModuleProgressReportPayload,
} from 'storybook/internal/core-events';
import { experimental_UniversalStore } from 'storybook/internal/core-server';
import { cleanPaths, oneWayHash, sanitizeError, telemetry } from 'storybook/internal/telemetry';
import type { Options, PresetProperty, PresetPropertyFn, StoryId } from 'storybook/internal/types';

import { isAbsolute, join } from 'pathe';
import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import {
  COVERAGE_DIRECTORY,
  STORYBOOK_ADDON_TEST_CHANNEL,
  type StoreState,
  TEST_PROVIDER_ID,
  storeOptions,
} from './constants';
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

  const store = experimental_UniversalStore.create<StoreState>({
    ...storeOptions,
    leader: true,
  });

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
    (eventName: string) =>
    (...args: any[]) => {
      if (args[0]?.providerId === TEST_PROVIDER_ID) {
        runTestRunner(channel, eventName, args);
      }
    };

  channel.on(TESTING_MODULE_RUN_REQUEST, execute(TESTING_MODULE_RUN_REQUEST));

  store.onStateChange((state) => {
    if (state.watching) {
      runTestRunner(channel);
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

    store.onStateChange(async (state, previous) => {
      if (state.watching && !previous.watching) {
        await telemetry('testing-module-watch-mode', {
          provider: TEST_PROVIDER_ID,
          watchMode: state.watching,
        });
      }
    });

    channel.on(
      TESTING_MODULE_PROGRESS_REPORT,
      async (payload: TestingModuleProgressReportPayload) => {
        if (payload.providerId !== TEST_PROVIDER_ID) {
          return;
        }
        const status = 'status' in payload ? payload.status : undefined;
        const progress = 'progress' in payload ? payload.progress : undefined;
        const error = 'error' in payload ? payload.error : undefined;

        const config = store.getState().config;

        if ((status === 'success' || status === 'cancelled') && progress?.finishedAt) {
          await telemetry('testing-module-completed-report', {
            provider: TEST_PROVIDER_ID,
            status,
            config,
            duration: progress?.finishedAt - progress?.startedAt,
            numTotalTests: progress?.numTotalTests,
            numFailedTests: progress?.numFailedTests,
            numPassedTests: progress?.numPassedTests,
            numSelectedStories: payload.details?.selectedStoryCount ?? 0,
          });
        }

        if (status === 'failed') {
          await telemetry('testing-module-completed-report', {
            provider: TEST_PROVIDER_ID,
            status,
            config,
            ...(options.enableCrashReports && {
              error: error && sanitizeError(error),
            }),
            numSelectedStories: payload.details?.selectedStoryCount ?? 0,
          });
        }
      }
    );

    channel.on(TESTING_MODULE_CRASH_REPORT, async (payload: TestingModuleCrashReportPayload) => {
      if (payload.providerId !== TEST_PROVIDER_ID) {
        return;
      }
      await telemetry('testing-module-crash-report', {
        provider: payload.providerId,

        ...(options.enableCrashReports && {
          error: cleanPaths(payload.error.message),
        }),
      });
    });
  }

  return channel;
};

export const previewAnnotations: PresetProperty<'previewAnnotations'> = async (
  entry = [],
  options
) => {
  checkActionsLoaded(options.configDir);
  return entry;
};

export const managerEntries: PresetProperty<'managerEntries'> = async (entry = [], options) => {
  // Throw an error when addon-interactions is used.
  // This is done by reading an annotation defined in addon-interactions, which although not ideal,
  // is a way to handle addon conflict without having to worry about the order of which they are registered
  const annotation = await options.presets.apply('ADDON_INTERACTIONS_IN_USE', false);
  if (annotation) {
    // eslint-disable-next-line local-rules/no-uncategorized-errors
    const error = new Error(
      dedent`
        You have both "@storybook/addon-interactions" and "@storybook/experimental-addon-test" listed as addons in your Storybook config. This is not allowed, as @storybook/experimental-addon-test is a replacement for @storybook/addon-interactions.

        Please remove "@storybook/addon-interactions" from the addons array in your main Storybook config at ${options.configDir} and remove the dependency from your package.json file.
      `
    );
    error.name = 'AddonConflictError';
    throw error;
  }

  // for whatever reason seems like the return type of managerEntries is not correct (it expects never instead of string[])
  return entry as never;
};

export const staticDirs: PresetPropertyFn<'staticDirs'> = async (values = [], options) => {
  if (options.configType === 'PRODUCTION') {
    return values;
  }

  const coverageDirectory = resolvePathInStorybookCache(COVERAGE_DIRECTORY);
  await mkdir(coverageDirectory, { recursive: true });
  return [
    {
      from: coverageDirectory,
      to: '/coverage',
    },
    ...values,
  ];
};
