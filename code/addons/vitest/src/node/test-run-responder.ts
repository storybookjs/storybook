import type { Channel } from '@storybook/core/internal/channels';
import {
  createFileSystemCache,
  resolvePathInStorybookCache,
} from '@storybook/core/internal/common';
import {
  internal_UniversalStore,
  experimental_getTestProviderStore,
} from '@storybook/core/internal/services';
import { getInstanceContext } from '@storybook/core/internal/instance';

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
import { createTestRunner, type TestRunner } from './boot-test-runner.ts';
import type { TestRunnerHost } from './host.ts';

/** One instance's test runner: its Vitest child and the store that drives it. */
export interface TestRunnerRuntime {
  /** The instance's Vitest child process. */
  readonly runner: TestRunner;
  /**
   * The instance's `storybook/test` store, seeded with the cached config and created once so the
   * request listener and the dev server share it; a failed setup is retried by the next caller.
   */
  ensureStore(channel: Channel): Promise<Store>;
  /** Kill the instance's Vitest child and stop syncing its store. */
  close(): void;
}

type ResponderOptions = {
  channel: Channel;
  storybook: TestRunnerHost;
  runner: TestRunner;
};

/** The preview builder name from the `core` preset value, however the builder was declared. */
export const resolvePreviewBuilderName = (
  core: { builder?: string | { name?: string } } | undefined
): string | undefined => (typeof core?.builder === 'string' ? core.builder : core?.builder?.name);

/** Creates the test runner state of one instance; nothing in it is shared with another instance. */
export function createTestRunnerRuntime(storybook: TestRunnerHost): TestRunnerRuntime {
  const runner = createTestRunner();
  let storePromise: Promise<Store> | undefined;
  return {
    runner,
    ensureStore: (channel) =>
      (storePromise ??= createTestRunnerStore({ channel, storybook, runner }).catch((error) => {
        storePromise = undefined;
        throw error;
      })),
    close: () => {
      runner.kill();
      storePromise?.then(
        (store) => store.__dispose(),
        () => {}
      );
    },
  };
}

const createTestRunnerStore = async ({
  channel,
  storybook,
  runner,
}: ResponderOptions): Promise<Store> => {
  const core = await storybook.callHook('core:config:extend', undefined);
  const configLoader =
    (typeof core?.builder !== 'string' &&
      (core?.builder?.options?.configLoader as BuilderOptions['configLoader'])) ||
    undefined;

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
  const store = internal_UniversalStore.create<StoreState, StoreEvent>({
    ...storeOptions,
    initialState: {
      ...storeOptions.initialState,
      ...selectCachedState(cachedState),
    },
    owner: true,
    channel,
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
    runner
      .run({
        channel,
        store,
        initEvent: STORE_CHANNEL_EVENT_NAME,
        initArgs: [internal_UniversalStore.eventMessage(event, eventInfo)],
        storybook,
        configLoader,
      })
      .catch(() => {
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
 * `core:services:register` hook — adjacent to the `test` toolset registration, behind the same gate — so
 * every consumer that can offer the tool can also answer it: the dev server and the `storybook
 * tools` CLI alike. The listener itself is cheap; the runner machinery is created on first
 * request.
 */
export const wireTestRunResponder = async ({
  channel,
  storybook,
  runtime,
}: {
  channel: Channel | undefined;
  storybook: TestRunnerHost;
  runtime: TestRunnerRuntime;
}): Promise<void> => {
  // The vitest child process loads this same Storybook configuration in-process; answering
  // requests from inside it could recursively boot another child.
  if (process.env.VITEST_CHILD_PROCESS === 'true') {
    return;
  }
  // An attached tools host shares the dev server's channel; the dev server owns `storybook/test`
  // and answers the requests itself.
  if (getInstanceContext()?.storybook?.attached) {
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
  const viteBuilder = !!resolvePreviewBuilderName(
    await storybook.callHook('core:config:extend', undefined)
  )?.includes('vite');

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
      store = await runtime.ensureStore(channel);
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
