import type { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';

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

describe('docgen worker extract', () => {
  it('answers one request with one result per entry', async () => {
    await import('./docgen-worker.ts');
    const { parentPort } = workerThreads;

    parentPort.emit('message', { type: 'init', descriptors: [], logLevel: 'info' });
    parentPort.emit('message', {
      type: 'extract',
      id: 0,
      entries: [{ id: 'a--default' }, { id: 'b--default' }],
    });

    await vi.waitFor(() => expect(parentPort.postMessage).toHaveBeenCalledTimes(2));
    expect(parentPort.postMessage.mock.calls.map(([message]) => message)).toEqual([
      { type: 'init' },
      { type: 'extract', id: 0, results: [{ payload: undefined }, { payload: undefined }] },
    ]);
  });

  it('finishes one request before it starts the next', async () => {
    await import('./docgen-worker.ts');
    const { parentPort } = workerThreads;
    const log: string[] = [];

    parentPort.emit('message', {
      type: 'init',
      descriptors: [
        {
          moduleSpecifier: fileURLToPath(new URL('./docgen-worker.fixture.ts', import.meta.url)),
          options: { log },
        },
      ],
      logLevel: 'info',
    });
    parentPort.emit('message', { type: 'extract', id: 0, entries: [{ id: 'a' }, { id: 'b' }] });
    parentPort.emit('message', { type: 'extract', id: 1, entries: [{ id: 'c' }] });

    await vi.waitFor(() => expect(parentPort.postMessage).toHaveBeenCalledTimes(3));
    expect(log).toEqual(['start a,b', 'end a,b', 'start c', 'end c']);
  });
});
