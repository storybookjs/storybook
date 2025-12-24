import { readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';

import type { Channel } from 'storybook/internal/channels';
import {
  createFileSystemCache,
  getFrameworkName,
  loadPreviewOrConfigFile,
  resolvePathInStorybookCache,
} from 'storybook/internal/common';
import { RUN_STORY_TESTS_REQUEST, RUN_STORY_TESTS_RESPONSE } from 'storybook/internal/core-events';
import {
  experimental_UniversalStore,
  experimental_getTestProviderStore,
} from 'storybook/internal/core-server';
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

      // Forward the event to the channel for bulk story test operations
      channel.emit('vitest-test-run-completed', event.payload);

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

  // Forward test case results from the test runner process to the channel
  channel.on('test-case-result', (result) => {
    channel.emit('vitest-test-case-result', result);
  });

  // Handle story discovery test requests
  channel.on(RUN_STORY_TESTS_REQUEST, async (data: any) => {
    try {
      const storyIds = data.payload.storyIds || [];
      const requestId = data.id;

      console.log('Running real tests for story discovery:', storyIds);

      // Track story discovery runs to match completion events
      const storyDiscoveryRuns = new Map<
        string,
        { resolve: Function; reject: Function; storyIds: string[] }
      >();

      // Create a promise that will resolve when the test run completes
      const testRunPromise = new Promise<any>((resolve, reject) => {
        storyDiscoveryRuns.set(requestId, { resolve, reject, storyIds });

        // Set a timeout for the entire operation
        const timeout = setTimeout(() => {
          storyDiscoveryRuns.delete(requestId);
          reject(new Error('Story discovery test run timed out after 60 seconds'));
        }, 60000);

        // Listen for test run completion events
        const handleTestRunCompleted = (event: any) => {
          const runData = storyDiscoveryRuns.get(requestId);
          if (runData && event.storyIds && arraysEqual(event.storyIds, runData.storyIds)) {
            clearTimeout(timeout);
            storyDiscoveryRuns.delete(requestId);
            channel.off('vitest-test-run-completed', handleTestRunCompleted);

            // Transform the real test results
            const testResults = (event.testResults || []).map((result: any) => ({
              storyId: result.storyId,
              status:
                result.testResult?.state === 'pass'
                  ? 'PASS'
                  : result.testResult?.state === 'fail'
                    ? 'FAIL'
                    : 'PENDING',
              componentFilePath: result.componentPath || '', // From test metadata
            }));

            resolve({
              testResults,
              testSummary: {
                total: event.totalTestCount || 0,
                passed: event.passedTestCount || 0,
                failed: event.failedTestCount || 0,
              },
            });
          }
        };

        channel.on('vitest-test-run-completed', handleTestRunCompleted);

        // Trigger the test run using the existing TRIGGER_RUN mechanism
        // This will go through the normal TestManager flow
        store.send({
          type: 'TRIGGER_RUN',
          payload: {
            storyIds,
            triggeredBy: 'story-discovery',
          },
        });
      });

      const testRunResult = await testRunPromise;

      console.log('Real test results:', testRunResult.testResults);
      console.log('Test summary:', testRunResult.testSummary);

      channel.emit(RUN_STORY_TESTS_RESPONSE, {
        success: true,
        id: requestId,
        payload: {
          success: true,
          testResults: testRunResult.testResults,
          testSummary: testRunResult.testSummary,
        },
        error: null,
      } satisfies any);
    } catch (error: any) {
      console.error('Error in story discovery test execution:', error);
      channel.emit(RUN_STORY_TESTS_RESPONSE, {
        success: false,
        id: data.id,
        error: error.message || 'Failed to run story tests',
      } satisfies any);
    }
  });

  // Helper function to compare arrays
  function arraysEqual(a: any[], b: any[]): boolean {
    if (a.length !== b.length) {
      return false;
    }
    return a.every((val, index) => val === b[index]);
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
