import { readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';

import type { Channel } from 'storybook/internal/channels';
import {
  createFileSystemCache,
  getFrameworkName,
  resolvePathInStorybookCache,
} from 'storybook/internal/common';
import {
  experimental_UniversalStore,
  experimental_getTestProviderStore,
} from 'storybook/internal/core-server';
import { cleanPaths, oneWayHash, sanitizeError, telemetry } from 'storybook/internal/telemetry';
import type { Options, PresetProperty, PresetPropertyFn, StoryId } from 'storybook/internal/types';

import { isEqual } from 'es-toolkit';
import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import {
  ADDON_ID,
  COVERAGE_DIRECTORY,
  STORE_CHANNEL_EVENT_NAME,
  STORYBOOK_ADDON_TEST_CHANNEL,
  storeOptions,
} from './constants';
import { log } from './logger';
import { runTestRunner } from './node/boot-test-runner';
import type { CachedState, ErrorLike, StoreState } from './types';
import type { StoreEvent } from './types';

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

  const fsCache = createFileSystemCache({
    basePath: resolvePathInStorybookCache(ADDON_ID.replace('/', '-')),
    ns: 'storybook',
    ttl: 14 * 24 * 60 * 60 * 1000, // 14 days
  });
  const cachedState: CachedState = await fsCache.get<CachedState>('state', {
    config: storeOptions.initialState.config,
    watching: storeOptions.initialState.watching,
  });

  const store = experimental_UniversalStore.create<StoreState, StoreEvent>({
    ...storeOptions,
    initialState: {
      ...storeOptions.initialState,
      ...cachedState,
    },
    leader: true,
  });
  store.onStateChange((state, previousState) => {
    const selectCachedState = (s: StoreState): CachedState => ({
      config: s.config,
      watching: s.watching,
    });
    if (!isEqual(selectCachedState(state), selectCachedState(previousState))) {
      fsCache.set('state', selectCachedState(state));
    }
  });
  if (cachedState.watching) {
    runTestRunner(channel, store);
  }
  const testProviderStore = experimental_getTestProviderStore(ADDON_ID);

  store.subscribe('TRIGGER_RUN', (event, eventInfo) => {
    testProviderStore.setState('test-provider-state:running');
    store.setState((s) => ({
      ...s,
      fatalError: undefined,
    }));
    runTestRunner(channel, store, STORE_CHANNEL_EVENT_NAME, [{ event, eventInfo }]);
  });
  store.subscribe('TOGGLE_WATCHING', (event, eventInfo) => {
    store.setState((s) => ({
      ...s,
      watching: event.payload.to,
      currentRun: {
        ...s.currentRun,
        // when enabling watch mode, clear the coverage summary too
        ...(event.payload.to && {
          coverageSummary: undefined,
        }),
      },
    }));
    if (event.payload.to) {
      runTestRunner(channel, store, STORE_CHANNEL_EVENT_NAME, [{ event, eventInfo }]);
    }
  });
  store.subscribe('FATAL_ERROR', (event) => {
    const { message, error } = event.payload;
    const name = error.name || 'Error';
    log(`${name}: ${message}`);
    if (error.stack) {
      log(error.stack);
    }

    function logErrorWithCauses(err: ErrorLike) {
      if (!err) {
        return;
      }

      log(`Caused by: ${err.name ?? 'Error'}: ${err.message}`);

      if (err.stack) {
        log(err.stack);
      }

      if (err.cause) {
        logErrorWithCauses(err.cause);
      }
    }

    if (error.cause) {
      logErrorWithCauses(error.cause);
    }
    store.setState((s) => ({
      ...s,
      fatalError: {
        message,
        error,
      },
    }));
    testProviderStore.setState('test-provider-state:crashed');
  });
  testProviderStore.onClearAll(() => {
    store.setState((s) => ({
      ...s,
      currentRun: { ...s.currentRun, coverageSummary: undefined, unhandledErrors: [] },
    }));
  });

  if (!core.disableTelemetry) {
    const enableCrashReports = core.enableCrashReports || options.enableCrashReports;
    const packageJsonPath = require.resolve('@storybook/addon-test/package.json');

    const { version: addonVersion } = JSON.parse(
      readFileSync(packageJsonPath, { encoding: 'utf-8' })
    );

    channel.on(STORYBOOK_ADDON_TEST_CHANNEL, (event: Event) => {
      telemetry('addon-test', {
        ...event,
        payload: {
          ...event.payload,
          storyId: oneWayHash(event.payload.storyId),
        },
        addonVersion,
      });
    });

    store.subscribe('TOGGLE_WATCHING', async (event) => {
      await telemetry('addon-test', {
        watchMode: event.payload.to,
        addonVersion,
      });
    });
    store.subscribe('TEST_RUN_COMPLETED', async (event) => {
      const { unhandledErrors, startedAt, finishedAt, storyIds, ...currentRun } = event.payload;
      await telemetry('addon-test', {
        ...currentRun,
        duration: (finishedAt ?? 0) - (startedAt ?? 0),
        selectedStoryCount: storyIds?.length ?? 0,
        unhandledErrorCount: unhandledErrors.length,
        ...(enableCrashReports &&
          unhandledErrors.length > 0 && {
            unhandledErrors: unhandledErrors.map((error) => sanitizeError(error)),
          }),
        addonVersion,
      });
    });

    if (enableCrashReports) {
      store.subscribe('FATAL_ERROR', async (event) => {
        await telemetry('addon-test', {
          fatalError: cleanPaths(event.payload.error.message),
          addonVersion,
        });
      });
    }
  }

  return channel;
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

export const managerEntries: PresetProperty<'managerEntries'> = async (entry = [], options) => {
  // Throw an error when addon-interactions is used.
  // This is done by reading an annotation defined in addon-interactions, which although not ideal,
  // is a way to handle addon conflict without having to worry about the order of which they are registered
  const annotation = await options.presets.apply('ADDON_INTERACTIONS_IN_USE', false);
  if (annotation) {
    // eslint-disable-next-line local-rules/no-uncategorized-errors
    const error = new Error(
      dedent`
        You have both "@storybook/addon-interactions" and "@storybook/addon-test" listed as addons in your Storybook config. This is not allowed, as @storybook/addon-test is a replacement for @storybook/addon-interactions.
        Please remove "@storybook/addon-interactions" from the addons array in your main Storybook config at ${options.configDir} and remove the dependency from your package.json file.
      `
    );
    error.name = 'AddonConflictError';
    throw error;
  }

  // for whatever reason seems like the return type of managerEntries is not correct (it expects never instead of string[])
  return entry as never;
};
