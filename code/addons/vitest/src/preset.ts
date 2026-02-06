import { mkdir } from 'node:fs/promises';

import type { Channel } from 'storybook/internal/channels';
import {
  createFileSystemCache,
  getFrameworkName,
  loadPreviewOrConfigFile,
  resolvePathInStorybookCache,
} from 'storybook/internal/common';
import {
  type StoryIndexGenerator,
  experimental_UniversalStore,
  experimental_getTestProviderStore,
} from 'storybook/internal/core-server';
import { logger } from 'storybook/internal/node-logger';
import { cleanPaths, oneWayHash, sanitizeError, telemetry } from 'storybook/internal/telemetry';
import type {
  Options,
  PresetPropertyFn,
  PreviewAnnotation,
  StoryId,
} from 'storybook/internal/types';

import { isEqual } from 'es-toolkit/predicate';
import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import { shouldLog } from '../../../core/src/node-logger/logger';
import {
  ADDON_ID,
  COVERAGE_DIRECTORY,
  STORE_CHANNEL_EVENT_NAME,
  STORYBOOK_ADDON_TEST_CHANNEL,
  TRIGGER_TEST_RUN_REQUEST,
  TRIGGER_TEST_RUN_RESPONSE,
  type TriggerTestRunRequestPayload,
  type TriggerTestRunResponsePayload,
  storeOptions,
} from './constants';
import { log } from './logger';
import { runTestRunner } from './node/boot-test-runner';
import type { CachedState, ErrorLike, StoreState } from './types';
import type { StoreEvent } from './types';

type Event =
  | {
      type: 'test-discrepancy';
      payload: {
        storyId: StoryId;
        browserStatus: 'PASS' | 'FAIL';
        cliStatus: 'FAIL' | 'PASS';
        message: string;
      };
    }
  | {
      type: 'test-run-completed';
      payload: StoreState['currentRun'];
    };

export const experimental_serverChannel = async (channel: Channel, options: Options) => {
  const core = await options.presets.apply('core');

  const previewPath = loadPreviewOrConfigFile({ configDir: options.configDir });
  const previewAnnotations = await options.presets.apply<PreviewAnnotation[]>(
    'previewAnnotations',
    [],
    options
  );

  const resolvedPreviewBuilder =
    typeof core?.builder === 'string' ? core.builder : core?.builder?.name;
  const framework = await getFrameworkName(options);

  // Only boot the test runner if the builder is vite, else just provide interactions functionality
  if (!resolvedPreviewBuilder?.includes('vite')) {
    if (framework.includes('nextjs')) {
      log(dedent`
        You're using ${framework}, which is a Webpack-based builder. In order to use Storybook's Vitest addon, with your project, you need to use '@storybook/nextjs-vite', a high performance Vite-based equivalent.

        Refer to the following documentation for more information: ${picocolors.yellow('https://storybook.js.org/docs/get-started/frameworks/nextjs-vite?ref=upgrade#choose-between-vite-and-webpack')}\n
      `);
    }
    return channel;
  }

  const storyIndexGenerator =
    await options.presets.apply<Promise<StoryIndexGenerator>>('storyIndexGenerator');

  const fsCache = createFileSystemCache({
    basePath: resolvePathInStorybookCache(ADDON_ID.replace('/', '-')),
    ns: 'storybook',
    ttl: 14 * 24 * 60 * 60 * 1000, // 14 days
  });
  const cachedState: CachedState = await fsCache.get<CachedState>('state', {
    config: storeOptions.initialState.config,
  });

  const selectCachedState = (s: Partial<StoreState>): Partial<CachedState> => ({
    config: s.config,
  });
  const store = experimental_UniversalStore.create<StoreState, StoreEvent>({
    ...storeOptions,
    initialState: {
      ...storeOptions.initialState,
      previewAnnotations: (previewAnnotations ?? []).concat(previewPath ?? []),
      index: await storyIndexGenerator.getIndex(),
      ...selectCachedState(cachedState),
    },
    leader: true,
  });
  store.onStateChange((state, previousState) => {
    if (!isEqual(selectCachedState(state), selectCachedState(previousState))) {
      fsCache.set('state', selectCachedState(state));
    }
  });
  const testProviderStore = experimental_getTestProviderStore(ADDON_ID);

  storyIndexGenerator.onInvalidated(async () => {
    try {
      const index = await storyIndexGenerator.getIndex();
      store.setState((s) => ({ ...s, index }));
    } catch (error) {
      logger.debug('Failed to update story index after invalidation');
      if (shouldLog('debug')) {
        logger.error(error);
      }
    }
  });

  store.subscribe('TRIGGER_RUN', (event, eventInfo) => {
    testProviderStore.setState('test-provider-state:running');
    store.setState((s) => ({
      ...s,
      fatalError: undefined,
    }));
    runTestRunner({
      channel,
      store,
      initEvent: STORE_CHANNEL_EVENT_NAME,
      initArgs: [{ event, eventInfo }],
      options,
    });
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
      runTestRunner({
        channel,
        store,
        initEvent: STORE_CHANNEL_EVENT_NAME,
        initArgs: [{ event, eventInfo }],
        options,
      });
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

  // Programmatic test run trigger API
  channel.on(TRIGGER_TEST_RUN_REQUEST, async (payload: TriggerTestRunRequestPayload) => {
    const { requestId, actor, storyIds, config: configOverride } = payload;

    const sendResponse = (response: Omit<TriggerTestRunResponsePayload, 'requestId'>) => {
      channel.emit(TRIGGER_TEST_RUN_RESPONSE, { requestId, ...response });
    };

    await store.untilReady();

    const {
      currentRun: { startedAt, finishedAt },
      config,
    } = store.getState();
    if (startedAt && !finishedAt) {
      sendResponse({
        status: 'error',
        error: { message: 'Tests are already running' },
      });
      return;
    }

    store.send({
      type: 'TRIGGER_RUN',
      payload: {
        storyIds,
        triggeredBy: `external:${actor}`,
        ...(configOverride && {
          configOverride: { ...config, ...configOverride },
        }),
      },
    });

    const unsubscribe = store.subscribe((event) => {
      switch (event.type) {
        case 'TEST_RUN_COMPLETED': {
          unsubscribe();
          sendResponse({ status: 'completed', result: event.payload });
          return;
        }
        case 'FATAL_ERROR': {
          unsubscribe();
          sendResponse({ status: 'error', error: event.payload });
          return;
        }
        case 'CANCEL_RUN': {
          unsubscribe();
          sendResponse({ status: 'cancelled' });
          return;
        }
      }
    });
  });

  if (!core.disableTelemetry) {
    const enableCrashReports = core.enableCrashReports || options.enableCrashReports;

    channel.on(STORYBOOK_ADDON_TEST_CHANNEL, (event: Event) => {
      if (event.type !== 'test-run-completed') {
        telemetry('addon-test', {
          ...event,
          payload: {
            ...event.payload,
            storyId: oneWayHash(event.payload.storyId),
          },
        });
      }
    });

    store.subscribe('TOGGLE_WATCHING', async (event) => {
      await telemetry('addon-test', {
        watchMode: event.payload.to,
      });
    });
    store.subscribe('TEST_RUN_COMPLETED', async (event) => {
      const { unhandledErrors, startedAt, finishedAt, ...currentRun } = event.payload;
      await telemetry('addon-test', {
        ...currentRun,
        duration: (finishedAt ?? 0) - (startedAt ?? 0),
        unhandledErrorCount: unhandledErrors.length,
        ...(enableCrashReports &&
          unhandledErrors.length > 0 && {
            unhandledErrors: unhandledErrors.map((error) => {
              const { stacks, ...errorWithoutStacks } = error;
              return sanitizeError(errorWithoutStacks);
            }),
          }),
      });
    });

    if (enableCrashReports) {
      store.subscribe('FATAL_ERROR', async (event) => {
        await telemetry('addon-test', {
          fatalError: cleanPaths(event.payload.error.message),
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
