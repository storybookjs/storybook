import type { Channel } from 'storybook/internal/channels';
import {
  createFileSystemCache,
  loadPreviewOrConfigFile,
  resolvePathInStorybookCache,
} from 'storybook/internal/common';
import {
  type StoryIndexGenerator,
  experimental_UniversalStore,
  experimental_getTestProviderStore,
} from 'storybook/internal/core-server';
import type { Options, PreviewAnnotation } from 'storybook/internal/types';

import type { BuilderOptions } from '@storybook/builder-vite';

import { isEqual } from 'es-toolkit/predicate';

import {
  ADDON_ID,
  STORE_CHANNEL_EVENT_NAME,
  TRIGGER_TEST_RUN_REQUEST,
  TRIGGER_TEST_RUN_RESPONSE,
  type TriggerTestRunRequestPayload,
  type TriggerTestRunResponsePayload,
  storeOptions,
} from '../constants.ts';
import { log } from '../logger.ts';
import type { CachedState, ErrorLike, Store, StoreEvent, StoreState } from '../types.ts';
import { errorToErrorLike } from '../utils.ts';
import { runTestRunner } from './boot-test-runner.ts';

type ResponderOptions = {
  channel: Channel;
  options: Options;
};

/** The preview builder name from the `core` preset value, however the builder was declared. */
export const resolvePreviewBuilderName = (
  core: { builder?: string | { name?: string } } | undefined
): string | undefined => (typeof core?.builder === 'string' ? core.builder : core?.builder?.name);

let storePromise: Promise<Store> | undefined;

/**
 * The machinery that answers a test-run request: the leader UniversalStore seeded with the story
 * index and cached config, and the subscriptions that boot the vitest child process and record
 * fatal errors. Memoized so the request listener (which runs it on first request) and the dev
 * server (which additionally runs it eagerly, because the manager UI needs the store immediately)
 * share one store.
 */
export const ensureTestRunnerStore = ({ channel, options }: ResponderOptions): Promise<Store> =>
  (storePromise ??= createTestRunnerStore({ channel, options }).catch((error) => {
    // A rejected setup must not be memoized: the next request retries instead of replaying the
    // cached rejection for the lifetime of the process.
    storePromise = undefined;
    throw error;
  }));

const createTestRunnerStore = async ({ channel, options }: ResponderOptions): Promise<Store> => {
  const core = await options.presets.apply('core');
  const configLoader =
    (typeof core?.builder !== 'string' &&
      (core?.builder?.options?.configLoader as BuilderOptions['configLoader'])) ||
    undefined;

  const previewPath = loadPreviewOrConfigFile({ configDir: options.configDir });
  const previewAnnotations = await options.presets.apply<PreviewAnnotation[]>(
    'previewAnnotations',
    [],
    options
  );
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
    leader:
      process.env.VITEST_CHILD_PROCESS !== 'true' &&
      process.env.STORYBOOK_ATTACHED_TOOLS !== 'true',
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
      configLoader,
    }).catch(() => {
      // A boot failure already reported itself: bootTestRunner sends FATAL_ERROR before
      // rethrowing. Consuming the rejection just keeps it from becoming an unhandled rejection.
    });
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

  return store;
};

/**
 * Answer test-run requests (`TRIGGER_TEST_RUN_REQUEST`) over the channel. Wired from the
 * `services` preset hook — adjacent to the `test` toolset registration, behind the same gate — so
 * every consumer that can offer the tool can also answer it: the dev server and the `storybook
 * tools` CLI alike. The listener itself is cheap; the runner machinery is created on first
 * request.
 */
export const wireTestRunResponder = async ({
  channel,
  options,
}: {
  channel: Channel | undefined;
  options: Options;
}): Promise<void> => {
  // The vitest child process loads this same Storybook configuration in-process; answering
  // requests from inside it could recursively boot another child.
  if (process.env.VITEST_CHILD_PROCESS === 'true') {
    return;
  }
  // An attached tools host shares the instance's channel. Answering here would create a second
  // UniversalStore leader for `storybook/test` and crash the running Storybook.
  if (process.env.STORYBOOK_ATTACHED_TOOLS === 'true') {
    return;
  }
  // Without a channel there is no bus to answer on. In practice every configuration loader
  // provides one (a transport-less local bus outside the dev server), so this is a type-level
  // guard rather than a reachable context.
  if (!channel) {
    return;
  }
  // The runner boots vitest, which only exists for Vite-built projects — the same condition
  // behind the dev server's server-channel early return. The listener still answers (with an
  // error) so a request against a Webpack project fails immediately instead of waiting out the
  // requester's timeout: the tool is offered wherever the addon is enabled, so it must never be
  // offered-but-silent.
  const viteBuilder = !!resolvePreviewBuilderName(await options.presets.apply('core'))?.includes(
    'vite'
  );

  // `currentRun.startedAt` is written by the vitest child once it actually starts, so it lags the
  // TRIGGER_RUN dispatched below; without this marker two back-to-back requests would both pass
  // the already-running check and the second would report a run it did not start.
  let requestInFlight = false;

  channel.on(TRIGGER_TEST_RUN_REQUEST, async (payload: TriggerTestRunRequestPayload) => {
    const { requestId, actor, storyIds, config: configOverride } = payload;

    const sendResponse = (response: Omit<TriggerTestRunResponsePayload, 'requestId'>) => {
      channel.emit(TRIGGER_TEST_RUN_RESPONSE, { requestId, ...response });
    };

    if (!viteBuilder) {
      sendResponse({
        status: 'error',
        error: {
          message:
            'Story tests require a Vite-based Storybook builder; this project uses a Webpack-based builder.',
        },
      });
      return;
    }

    let store: Store;
    try {
      store = await ensureTestRunnerStore({ channel, options });
    } catch (error) {
      // Without a response the requester would wait out its full timeout; the dev server sets the
      // machinery up at startup and crashes visibly there, but a lazy consumer only learns of a
      // broken setup here.
      sendResponse({
        status: 'error',
        error: {
          message: 'Failed to set up the test runner',
          error: error instanceof Error ? errorToErrorLike(error) : { message: String(error) },
        },
      });
      return;
    }

    await store.untilReady();

    const {
      currentRun: { startedAt, finishedAt },
      config,
    } = store.getState();
    if ((startedAt && !finishedAt) || requestInFlight) {
      sendResponse({
        status: 'error',
        error: { message: 'Tests are already running' },
      });
      return;
    }
    requestInFlight = true;

    const unsubscribe = store.subscribe((event) => {
      switch (event.type) {
        case 'TEST_RUN_COMPLETED': {
          requestInFlight = false;
          unsubscribe();
          sendResponse({ status: 'completed', result: event.payload });
          return;
        }
        case 'FATAL_ERROR': {
          requestInFlight = false;
          unsubscribe();
          sendResponse({ status: 'error', error: event.payload });
          return;
        }
        case 'CANCEL_RUN': {
          requestInFlight = false;
          unsubscribe();
          sendResponse({ status: 'cancelled' });
          return;
        }
      }
    });

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
  });
};
