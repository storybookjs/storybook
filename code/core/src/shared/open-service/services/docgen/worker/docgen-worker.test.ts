import type { EventEmitter } from 'node:events';

import { join } from 'pathe';

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

describe('docgen worker summary providers', () => {
  it('keeps extracting docgen when a module fails to create its summary provider', async () => {
    await import('./docgen-worker.ts');
    const { parentPort } = workerThreads;
    const entry = { id: 'button--default', title: 'Button', importPath: './Button.stories.tsx' };

    parentPort.emit('message', {
      type: 'init',
      descriptors: [
        {
          moduleSpecifier: join(import.meta.dirname, '__testfixtures__/failing-summary-module.ts'),
        },
      ],
      logLevel: 'info',
    });
    await vi.waitFor(() => expect(parentPort.postMessage).toHaveBeenCalledWith({ type: 'init' }));

    parentPort.emit('message', { type: 'extract', id: 1, entry });
    parentPort.emit('message', { type: 'summarize', id: 2, entries: [entry] });

    await vi.waitFor(() => {
      expect(parentPort.postMessage).toHaveBeenCalledWith({
        type: 'extract',
        id: 1,
        payload: { id: entry.id, name: 'Button', path: entry.importPath, jsDocTags: {} },
      });
      expect(parentPort.postMessage).toHaveBeenCalledWith({
        type: 'summarize',
        id: 2,
        summaries: undefined,
      });
    });
  });
});
