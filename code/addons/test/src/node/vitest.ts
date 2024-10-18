import process from 'node:process';

import { Channel } from 'storybook/internal/channels';

import { TestManager } from './test-manager';

process.env.TEST = 'true';
process.env.VITEST = 'true';
process.env.NODE_ENV ??= 'test';

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

new TestManager(channel, {
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
