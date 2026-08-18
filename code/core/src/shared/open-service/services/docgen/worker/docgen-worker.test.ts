import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';

const workerThreads = vi.hoisted(() => ({ workerData: undefined as unknown }));

vi.mock('node:worker_threads', async () => {
  const { EventEmitter } = await import('node:events');
  return {
    parentPort: Object.assign(new EventEmitter(), { postMessage: vi.fn() }),
    get workerData() {
      return workerThreads.workerData;
    },
  };
});

// Override the global setup stub: these tests assert on the real logger's level state.
vi.mock('storybook/internal/node-logger', { spy: true });

// The entry applies the level while evaluating, so each load needs a fresh module registry; the
// mocked logger survives the reset, which is what lets the assertions read its state.
const loadWorker = async () => {
  vi.resetModules();
  await import('./docgen-worker.ts');
};

afterEach(() => {
  workerThreads.workerData = undefined;
  logger.setLogLevel('info');
});

describe('docgen worker log level', () => {
  it('applies the log level forwarded via workerData to its logger', async () => {
    workerThreads.workerData = { logLevel: 'debug' };
    await loadWorker();
    expect(logger.getLogLevel()).toBe('debug');
  });

  it('leaves the logger level untouched when workerData carries none', async () => {
    logger.setLogLevel('warn');
    await loadWorker();
    expect(logger.getLogLevel()).toBe('warn');
  });
});
