import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocgenProviderDescriptor } from '../types.ts';
import type { DocgenWorkerRequest, DocgenWorkerResponse } from './protocol.ts';

interface FakeWorker {
  posted: DocgenWorkerRequest[];
  postMessage: ReturnType<typeof vi.fn>;
  terminate: ReturnType<typeof vi.fn>;
  unref: ReturnType<typeof vi.fn>;
  ref: ReturnType<typeof vi.fn>;
  /** `message` listeners registered at the moment `unref()` ran; see the ordering test below. */
  messageListenersAtUnref: number;
  emit: (event: string, ...args: unknown[]) => boolean;
}

const fakeWorkers: FakeWorker[] = [];

vi.mock('node:worker_threads', async () => {
  const { EventEmitter: NodeEventEmitter } = await import('node:events');

  class FakeWorkerImpl extends NodeEventEmitter {
    posted: DocgenWorkerRequest[] = [];
    constructor(_scriptPath: string) {
      super();
      fakeWorkers.push(this as unknown as FakeWorker);
    }
    postMessage = vi.fn((msg: DocgenWorkerRequest) => {
      this.posted.push(msg);
    });
    terminate = vi.fn(async () => 0);
    messageListenersAtUnref = -1;
    unref = vi.fn(() => {
      this.messageListenersAtUnref = this.listenerCount('message');
    });
    ref = vi.fn();
  }

  return { Worker: FakeWorkerImpl };
});

vi.mock('node:fs', () => ({ existsSync: vi.fn(() => true) }));

vi.mock('../../../../utils/module.ts', () => ({
  // Drive letter included so `fileURLToPath()` accepts this URL on Windows too.
  importMetaResolve: vi.fn(() => 'file:///C:/fake/storybook/docgen-worker.js'),
}));

vi.mock('storybook/internal/node-logger', { spy: true });

const loadModule = async () => import('./docgen-worker-client.ts');

const DESCRIPTORS: DocgenProviderDescriptor[] = [
  { moduleSpecifier: '/fake/react/docgen-worker.js' },
];

function ackInit(worker: FakeWorker, error?: { name: string; message: string }) {
  worker.emit(
    'message',
    (error ? { type: 'init', error } : { type: 'init' }) satisfies DocgenWorkerResponse
  );
}

beforeEach(() => {
  fakeWorkers.length = 0;
});

afterEach(() => {
  vi.clearAllMocks();
  fakeWorkers.length = 0;
});

describe('createDocgenWorkerClient', () => {
  it('returns undefined when the compiled worker script is missing', async () => {
    const fs = await import('node:fs');
    vi.mocked(fs.existsSync).mockReturnValueOnce(false);

    const { createDocgenWorkerClient } = await loadModule();
    expect(createDocgenWorkerClient(DESCRIPTORS)).toBeUndefined();
    expect(fakeWorkers).toHaveLength(0);
  });

  it('does not spawn a worker until the first extract', async () => {
    const { createDocgenWorkerClient } = await loadModule();
    const client = createDocgenWorkerClient(DESCRIPTORS);

    expect(client).toBeDefined();
    expect(fakeWorkers).toHaveLength(0);
  });

  it('forwards the current log level in the init request', async () => {
    const { logger } = await import('storybook/internal/node-logger');
    vi.mocked(logger.getLogLevel).mockReturnValueOnce('debug');

    const { createDocgenWorkerClient } = await loadModule();
    const client = createDocgenWorkerClient(DESCRIPTORS)!;
    client.extract({ id: 'button--primary' } as any).catch(() => undefined);

    expect(fakeWorkers[0].posted[0]).toEqual({
      type: 'init',
      descriptors: DESCRIPTORS,
      logLevel: 'debug',
    });
  });

  it('spawns the worker lazily on the first extract and posts init with descriptors', async () => {
    const { createDocgenWorkerClient } = await loadModule();
    const client = createDocgenWorkerClient(DESCRIPTORS)!;

    const promise = client.extract({ id: 'button--primary' } as any);
    const worker = fakeWorkers[0];

    expect(fakeWorkers).toHaveLength(1);
    expect(worker.posted[0]).toMatchObject({ type: 'init', descriptors: DESCRIPTORS });
    expect(worker.unref).not.toHaveBeenCalled();

    ackInit(worker);
    await Promise.resolve();
    const extractMsg = worker.posted.find((m) => m.type === 'extract') as { id: number };
    // Loose on purpose: a transient unref can land before the extract continuation runs.
    expect(worker.ref).toHaveBeenCalled();
    worker.emit('message', {
      type: 'extract',
      id: extractMsg.id,
      payload: { id: 'button', name: 'Button', path: './button.stories.tsx', jsDocTags: {} },
    } satisfies DocgenWorkerResponse);
    await expect(promise).resolves.toMatchObject({ id: 'button' });
    const lastRef = Math.max(...worker.ref.mock.invocationCallOrder);
    const lastUnref = Math.max(...worker.unref.mock.invocationCallOrder);
    expect(lastUnref).toBeGreaterThan(lastRef);

    // Attaching a `message` listener re-refs the port, so unref before that holds the loop open.
    expect(worker.messageListenersAtUnref).toBeGreaterThan(0);
  });
});

describe('DocgenWorkerClient.extract', () => {
  it('waits for init, dispatches the entry, and resolves the payload', async () => {
    const { createDocgenWorkerClient } = await loadModule();
    const client = createDocgenWorkerClient(DESCRIPTORS)!;

    const entry = { id: 'button--primary', importPath: './button.stories.tsx' } as any;
    const promise = client.extract(entry);
    const worker = fakeWorkers[0];

    expect(worker.posted.filter((m) => m.type === 'extract')).toHaveLength(0);
    ackInit(worker);
    await Promise.resolve();

    const extractMsg = worker.posted.find((m) => m.type === 'extract');
    expect(extractMsg).toMatchObject({ type: 'extract', entry });

    worker.emit('message', {
      type: 'extract',
      id: (extractMsg as { id: number }).id,
      payload: { id: 'button', name: 'Button', path: './button.stories.tsx', jsDocTags: {} },
    } satisfies DocgenWorkerResponse);

    await expect(promise).resolves.toMatchObject({ id: 'button', name: 'Button' });
  });

  it('rejects extract calls when init fails', async () => {
    const { createDocgenWorkerClient } = await loadModule();
    const client = createDocgenWorkerClient(DESCRIPTORS)!;

    const promise = client.extract({ id: 'x' } as any);
    const worker = fakeWorkers[0];
    ackInit(worker, { name: 'Error', message: 'boom' });

    await expect(promise).rejects.toThrow('boom');
  });

  it('rejects an extract awaiting init when the worker exits before init', async () => {
    const { createDocgenWorkerClient } = await loadModule();
    const client = createDocgenWorkerClient(DESCRIPTORS)!;

    const promise = client.extract({ id: 'x' } as any);
    const worker = fakeWorkers[0];
    worker.emit('exit', 1);

    await expect(promise).rejects.toThrow(/exited unexpectedly/);
  });

  it('rejects with the error name/message from a failed extraction', async () => {
    const { createDocgenWorkerClient } = await loadModule();
    const client = createDocgenWorkerClient(DESCRIPTORS)!;

    const promise = client.extract({ id: 'x' } as any);
    const worker = fakeWorkers[0];
    ackInit(worker);
    await Promise.resolve();

    const extractMsg = worker.posted.find((m) => m.type === 'extract') as { id: number };
    worker.emit('message', {
      type: 'extract',
      id: extractMsg.id,
      error: { name: 'DocgenError', message: 'extraction exploded' },
    } satisfies DocgenWorkerResponse);

    await expect(promise).rejects.toThrowError(
      expect.objectContaining({ name: 'DocgenError', message: 'extraction exploded' })
    );
  });

  it('rejects in-flight extractions when the worker exits unexpectedly', async () => {
    const { createDocgenWorkerClient } = await loadModule();
    const client = createDocgenWorkerClient(DESCRIPTORS)!;

    const promise = client.extract({ id: 'x' } as any);
    const worker = fakeWorkers[0];
    ackInit(worker);
    await Promise.resolve();

    worker.emit('exit', 1);

    await expect(promise).rejects.toThrow(/exited unexpectedly/);
  });

  it('names the death in every extract that follows it', async () => {
    const { createDocgenWorkerClient } = await loadModule();
    const client = createDocgenWorkerClient(DESCRIPTORS)!;

    const first = client.extract({ id: 'x' } as any);
    ackInit(fakeWorkers[0]);
    await Promise.resolve();
    fakeWorkers[0].emit('error', new Error('worker ran out of memory'));
    await expect(first).rejects.toThrow('worker ran out of memory');

    // Never served a request, so the next extract reuses the corpse rather than respawning into
    // the same failure - and says what that failure was.
    await expect(client.extract({ id: 'y' } as any)).rejects.toThrow(
      'docgen worker is no longer running: worker ran out of memory'
    );
    expect(fakeWorkers).toHaveLength(1);
  });

  it('spawns a replacement once a dead worker had served requests', async () => {
    const { createDocgenWorkerClient } = await loadModule();
    const client = createDocgenWorkerClient(DESCRIPTORS)!;

    const first = client.extract({ id: 'x' } as any);
    ackInit(fakeWorkers[0]);
    await Promise.resolve();
    const extractMsg = fakeWorkers[0].posted.find((m) => m.type === 'extract') as { id: number };
    fakeWorkers[0].emit('message', {
      type: 'extract',
      id: extractMsg.id,
      payload: { id: 'x', name: 'X', path: './x.stories.ts', jsDocTags: {} },
    } satisfies DocgenWorkerResponse);
    await expect(first).resolves.toMatchObject({ id: 'x' });

    fakeWorkers[0].emit('error', new Error('worker ran out of memory'));

    const second = client.extract({ id: 'y' } as any);
    expect(fakeWorkers).toHaveLength(2);
    ackInit(fakeWorkers[1]);
    await Promise.resolve();
    const retryMsg = fakeWorkers[1].posted.find((m) => m.type === 'extract') as { id: number };
    fakeWorkers[1].emit('message', {
      type: 'extract',
      id: retryMsg.id,
      payload: { id: 'y', name: 'Y', path: './y.stories.ts', jsDocTags: {} },
    } satisfies DocgenWorkerResponse);
    await expect(second).resolves.toMatchObject({ id: 'y' });
  });
});

describe('DocgenWorkerClient.extract queueing', () => {
  const TIMEOUT_MS = 120_000;

  const extractIds = (worker: FakeWorker) =>
    worker.posted.flatMap((m) => (m.type === 'extract' ? [m.id] : []));

  const respond = (worker: FakeWorker, id: number, name: string) =>
    worker.emit('message', {
      type: 'extract',
      id,
      payload: { id: name, name, path: `./${name}.stories.ts`, jsDocTags: {} },
    } satisfies DocgenWorkerResponse);

  const startWithQueue = async (count: number) => {
    const { createDocgenWorkerClient } = await loadModule();
    const client = createDocgenWorkerClient(DESCRIPTORS)!;
    const results = Array.from({ length: count }, (_, i) => {
      const promise = client.extract({ id: `c${i}--story` } as any);
      promise.catch(() => undefined);
      return promise;
    });
    const worker = fakeWorkers[0];
    ackInit(worker);
    await vi.advanceTimersByTimeAsync(0);
    return { worker, results };
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('posts one extract at a time and the next once the worker answers', async () => {
    const { worker, results } = await startWithQueue(3);

    expect(extractIds(worker)).toHaveLength(1);
    respond(worker, extractIds(worker)[0], 'c0');
    await expect(results[0]).resolves.toMatchObject({ id: 'c0' });

    expect(extractIds(worker)).toHaveLength(2);
    expect(worker.posted.at(-1)).toMatchObject({ type: 'extract', entry: { id: 'c1--story' } });
  });

  it('starts each timeout when the extract is posted, not when it is queued', async () => {
    const { worker, results } = await startWithQueue(3);

    // Each extract takes most of the timeout. Together they take far longer than one timeout,
    // which used to time out every extract behind the first.
    for (const [index, result] of results.entries()) {
      await vi.advanceTimersByTimeAsync(TIMEOUT_MS - 1_000);
      respond(worker, extractIds(worker)[index], `c${index}`);
      await expect(result).resolves.toMatchObject({ id: `c${index}` });
    }
  });

  it('times out a stuck extract and moves on to the next', async () => {
    const { worker, results } = await startWithQueue(2);
    const [stuckId] = extractIds(worker);

    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
    await expect(results[0]).rejects.toThrow(
      `docgen worker extract ${stuckId} timed out after ${TIMEOUT_MS}ms`
    );

    const [, nextId] = extractIds(worker);
    expect(nextId).toBeDefined();
    // A late answer for the timed-out extract is ignored.
    respond(worker, stuckId, 'c0');
    respond(worker, nextId, 'c1');
    await expect(results[1]).resolves.toMatchObject({ id: 'c1' });
  });

  it('rejects queued extracts when the worker dies', async () => {
    const { worker, results } = await startWithQueue(3);

    worker.emit('error', new Error('worker ran out of memory'));

    for (const result of results) {
      await expect(result).rejects.toThrow('worker ran out of memory');
    }
    expect(extractIds(worker)).toHaveLength(1);
  });
});
