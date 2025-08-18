import process from 'node:process';

import { Channel } from 'storybook/internal/channels';
import {
  experimental_UniversalStore,
  experimental_getStatusStore,
  experimental_getTestProviderStore,
} from 'storybook/internal/core-server';

import {
  ADDON_ID,
  STATUS_TYPE_ID_A11Y,
  STATUS_TYPE_ID_COMPONENT_TEST,
  storeOptions,
} from '../constants';
import type { ErrorLike, FatalErrorEvent, StoreEvent, StoreState } from '../types';
import { TestManager } from './test-manager';

// Destructure the imported functions for easier access
const UniversalStore = experimental_UniversalStore;
const getStatusStore = experimental_getStatusStore;
const getTestProviderStore = experimental_getTestProviderStore;

const channel: Channel = new Channel({
  async: true,
  transport: {
    send: (event) => {
      process.send?.(event);
    },
    setHandler: (handler) => {
      process.on('message', handler);
    },
  },
});

(UniversalStore as any).__prepare(channel, UniversalStore.Environment.SERVER);

const store = UniversalStore.create<StoreState, StoreEvent>(storeOptions);

new TestManager({
  store,
  componentTestStatusStore: getStatusStore(STATUS_TYPE_ID_COMPONENT_TEST),
  a11yStatusStore: getStatusStore(STATUS_TYPE_ID_A11Y),
  testProviderStore: getTestProviderStore(ADDON_ID),
  onReady: () => {
    process.send?.({ type: 'ready' });
  },
  storybookOptions: {
    configDir: process.env.STORYBOOK_CONFIG_DIR || '',
  } as any,
});

const exit = (code = 0) => {
  channel?.removeAllListeners();
  process.exit(code);
};

const createUnhandledErrorHandler = (message: string) => async (error: ErrorLike) => {
  try {
    const payload: FatalErrorEvent['payload'] = {
      message,
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack,
        cause: error.cause as ErrorLike,
      },
    };
    // Node.js will exit immediately in these situations, so we can't send an event via the universal store
    // because the process will exit before the event is sent.
    // we're sending it manually instead, so the parent process can forward it to the store.
    process.send?.({
      type: 'uncaught-error',
      payload,
    });
  } finally {
    exit(1);
  }
};

process.on(
  'uncaughtException',
  createUnhandledErrorHandler('Uncaught exception in the test runner process')
);
process.on(
  'unhandledRejection',
  createUnhandledErrorHandler('Unhandled rejection in the test runner process')
);

process.on('exit', exit);
process.on('SIGINT', () => exit(0));
process.on('SIGTERM', () => exit(0));
