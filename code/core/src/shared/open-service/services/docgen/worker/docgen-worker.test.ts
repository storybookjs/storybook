import type { EventEmitter } from 'node:events';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';

const workerThreads = vi.hoisted(() => ({
  parentPort: undefined as unknown as EventEmitter & { postMessage: ReturnType<typeof vi.fn> },
}));

vi.mock('node:worker_threads', async () => {
  const { EventEmitter } = await import('node:events');
  workerThreads.parentPort = Object.assign(new EventEmitter(), { postMessage: vi.fn() });
  return { parentPort: workerThreads.parentPort };
});

// Override the global setup stub: these tests assert on the real logger's level state.
vi.mock('storybook/internal/node-logger', { spy: true });

afterEach(() => {
  logger.setLogLevel('info');
  vi.clearAllMocks();
});

describe('docgen worker log level', () => {
  it('applies the log level from init before composing providers', async () => {
    await import('./docgen-worker.ts');

    workerThreads.parentPort.emit('message', {
      type: 'init',
      descriptors: [],
      logLevel: 'debug',
    });

    expect(logger.setLogLevel).toHaveBeenCalledWith('debug');
  });
});

describe('docgen worker queue', () => {
  it('announces each extraction when its turn comes, one at a time', async () => {
    await import('./docgen-worker.ts');
    const { parentPort } = workerThreads;

    parentPort.emit('message', { type: 'init', descriptors: [], logLevel: 'info' });
    parentPort.emit('message', { type: 'extract', id: 0, entry: { id: 'a--default' } });
    parentPort.emit('message', { type: 'extract', id: 1, entry: { id: 'b--default' } });

    await vi.waitFor(() => expect(parentPort.postMessage).toHaveBeenCalledTimes(5));
    expect(parentPort.postMessage.mock.calls.map(([message]) => message)).toEqual([
      { type: 'init' },
      { type: 'started', id: 0 },
      { type: 'extract', id: 0, payload: undefined },
      { type: 'started', id: 1 },
      { type: 'extract', id: 1, payload: undefined },
    ]);
  });
});
