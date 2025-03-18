import { createRequire } from 'node:module';
import process from 'node:process';

import { Channel } from 'storybook/internal/channels';

import type { StoreEvent, StoreState } from '../constants';
import {
  ADDON_ID,
  STATUS_TYPE_ID_A11Y,
  STATUS_TYPE_ID_COMPONENT_TEST,
  storeOptions,
} from '../constants';
import { TestManager } from './test-manager';

const require = createRequire(import.meta.url);

// we need to require core-server here, because its ESM output is not valid
const {
  experimental_UniversalStore: UniversalStore,
  experimental_getStatusStore: getStatusStore,
  experimental_getTestProviderStore: getTestProviderStore,
} = require('storybook/internal/core-server') as {
  experimental_UniversalStore: typeof import('storybook/internal/core-server').experimental_UniversalStore;
  experimental_getStatusStore: typeof import('storybook/internal/core-server').experimental_getStatusStore;
  experimental_getTestProviderStore: typeof import('storybook/internal/core-server').experimental_getTestProviderStore;
};

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

// eslint-disable-next-line no-underscore-dangle
(UniversalStore as any).__prepare(channel, UniversalStore.Environment.SERVER);

new TestManager({
  channel,
  store: UniversalStore.create<StoreState, StoreEvent>(storeOptions),
  componentTestStatusStore: getStatusStore(STATUS_TYPE_ID_COMPONENT_TEST),
  a11yStatusStore: getStatusStore(STATUS_TYPE_ID_A11Y),
  testProviderStore: getTestProviderStore(ADDON_ID),
  onError: (message, error) => {
    process.send?.({ type: 'error', message, error: error.stack ?? error });
  },
  onReady: () => {
    process.send?.({ type: 'ready' });
  },
});

const exit = (code = 0) => {
  channel?.removeAllListeners();
  process.exit(code);
};

process.on('exit', exit);
process.on('SIGINT', () => exit(0));
process.on('SIGTERM', () => exit(0));

process.on('uncaughtException', (err) => {
  process.send?.({ type: 'error', message: 'Uncaught exception', error: err.stack });
  exit(1);
});

process.on('unhandledRejection', (reason) => {
  process.send?.({ type: 'error', message: 'Unhandled rejection', error: String(reason) });
  exit(1);
});
