import { createRequire } from 'node:module';
import process from 'node:process';

import { Channel } from 'storybook/internal/channels';

import type { StoreState } from '../constants';
import { storeOptions } from '../constants';
import { TestManager } from './test-manager';

const require = createRequire(import.meta.url);
// we need to require core-server here, because its ESM output is not valid
// eslint-disable-next-line @typescript-eslint/naming-convention
const { experimental_UniversalStore } = require('storybook/internal/core-server') as {
  experimental_UniversalStore: typeof import('storybook/internal/core-server').experimental_UniversalStore;
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
(experimental_UniversalStore as any).__prepare(
  channel,
  experimental_UniversalStore.Environment.SERVER
);

new TestManager(channel, experimental_UniversalStore.create<StoreState>(storeOptions), {
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
