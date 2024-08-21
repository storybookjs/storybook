import { fork } from 'node:child_process';
import { join } from 'node:path';

import type { Channel } from 'storybook/internal/channels';
import type { Options } from 'storybook/internal/types';

import { FILE_CHANGED_EVENT, REQUEST_COVERAGE_EVENT } from './constants';

// eslint-disable-next-line @typescript-eslint/naming-convention
export const experimental_serverChannel = async (channel: Channel, options: Options) => {
  process.env.TEST = 'true';
  process.env.VITEST = 'true';
  process.env.NODE_ENV ??= 'test';

  const controller = new AbortController();
  const { signal } = controller;
  const sub = join(__dirname, 'node', 'vitest.mjs');
  const child = fork(sub, [], { signal, stdio: 'ignore' });
  child.on('error', (err) => {
    // TODO: restart the child?
    console.error('Error in vitest child', err);
  });
  child.on('message', (message: any) => {
    if (message.type) {
      channel.emit(message.type, ...(message.args || []));
    }
  });

  // TODO: ensure this stays in sync with the vitest manager implementation
  channel.on(REQUEST_COVERAGE_EVENT, (...args) => {
    child.send({ type: REQUEST_COVERAGE_EVENT, args, from: 'server' });
  });
  channel.on(FILE_CHANGED_EVENT, (...args) => {
    child.send({ type: FILE_CHANGED_EVENT, args, from: 'server' });
  });

  return channel;
};
