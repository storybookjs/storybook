import process from 'node:process';

import { Channel } from 'storybook/internal/channels';

import { CoverageManager } from './coverage-manager';

const channel: Channel = new Channel({
  async: true,
  transport: {
    send: (event) => {
      if (process.send) {
        process.send(event);
      }
    },
    setHandler: (handler) => {
      process.on('message', handler);
    },
  },
});

new CoverageManager(channel);
