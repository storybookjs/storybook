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

describe('DocgenWorkerClient queue', () => {
  const entries = ['a', 'b', 'c'].map((id) => ({ id, title: `Example/${id}` }) as any);
  const extractRequests = (worker: FakeWorker) =>
    worker.posted.filter((m) => m.type === 'extract') as { id: number; entry: { id: string } }[];
  const answerLatest = (worker: FakeWorker) => {
    const { id, entry } = extractRequests(worker).at(-1)!;
    worker.emit('message', {
      type: 'extract',
      id,
      payload: { id: entry.id, name: entry.id, path: `./${entry.id}.stories.ts`, jsDocTags: {} },
    } satisfies DocgenWorkerResponse);
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends the worker one extraction at a time, in request order', async () => {
    const { createDocgenWorkerClient } = await loadModule();
    const client = createDocgenWorkerClient(DESCRIPTORS)!;

    const results = entries.map((entry) => client.extract(entry));
    const worker = fakeWorkers[0];
    ackInit(worker);
    await vi.advanceTimersByTimeAsync(0);
    expect(extractRequests(worker).map((m) => m.entry.id)).toEqual(['a']);

    answerLatest(worker);
    expect(extractRequests(worker).map((m) => m.entry.id)).toEqual(['a', 'b']);
    answerLatest(worker);
    answerLatest(worker);

    await expect(Promise.all(results)).resolves.toMatchObject([
      { id: 'a' },
      { id: 'b' },
      { id: 'c' },
    ]);
  });

  it('starts the time limit when an extraction is sent, not when it is queued', async () => {
    const { createDocgenWorkerClient } = await loadModule();
    const client = createDocgenWorkerClient(DESCRIPTORS, { taskTimeoutMs: 1000 })!;

    const results = entries.map((entry) => client.extract(entry));
    const worker = fakeWorkers[0];
    ackInit(worker);

    for (const _ of entries) {
      await vi.advanceTimersByTimeAsync(600);
      answerLatest(worker);
    }

    await expect(Promise.all(results)).resolves.toHaveLength(3);
    expect(worker.terminate).not.toHaveBeenCalled();
  });

  it('terminates the worker when an extraction runs past its limit', async () => {
    const { createDocgenWorkerClient } = await loadModule();
    const client = createDocgenWorkerClient(DESCRIPTORS, { taskTimeoutMs: 1000 })!;

    const results = entries.map((entry) => client.extract(entry));
    const settled = Promise.allSettled(results);
    const worker = fakeWorkers[0];
    ackInit(worker);
    await vi.advanceTimersByTimeAsync(1000);

    const timedOut = 'docgen extraction of "Example/a" timed out after 1000ms';
    expect(await settled).toMatchObject([
      { status: 'rejected', reason: { message: timedOut } },
      { status: 'rejected', reason: { message: timedOut } },
      { status: 'rejected', reason: { message: timedOut } },
    ]);
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(extractRequests(worker).map((m) => m.entry.id)).toEqual(['a']);
  });

  it('never times out when the limit is 0', async () => {
    const { createDocgenWorkerClient } = await loadModule();
    const client = createDocgenWorkerClient(DESCRIPTORS, { taskTimeoutMs: 0 })!;

    const result = client.extract(entries[0]);
    const worker = fakeWorkers[0];
    ackInit(worker);
    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
    answerLatest(worker);

    await expect(result).resolves.toMatchObject({ id: 'a' });
  });
});

describe('DocgenWorkerClient.prepare', () => {
  it('sends the announced entries to a worker spawned afterwards, before any extract', async () => {
    const { createDocgenWorkerClient } = await loadModule();
    const client = createDocgenWorkerClient(DESCRIPTORS)!;
    const batch = [{ id: 'a' }, { id: 'b' }] as any;

    client.prepare(batch);
    expect(fakeWorkers).toHaveLength(0);

    client.extract(batch[0]).catch(() => undefined);
    ackInit(fakeWorkers[0]);
    await Promise.resolve();

    expect(fakeWorkers[0].posted.map((m) => m.type)).toEqual(['init', 'prepare', 'extract']);
    expect(fakeWorkers[0].posted[1]).toEqual({ type: 'prepare', entries: batch });
  });

  it('sends the announced entries to a running worker', async () => {
    const { createDocgenWorkerClient } = await loadModule();
    const client = createDocgenWorkerClient(DESCRIPTORS)!;
    const batch = [{ id: 'a' }] as any;

    client.extract(batch[0]).catch(() => undefined);
    client.prepare(batch);

    expect(fakeWorkers[0].posted.at(-1)).toEqual({ type: 'prepare', entries: batch });
  });

  it('sends the announced entries again to a replacement worker', async () => {
    const { createDocgenWorkerClient } = await loadModule();
    const client = createDocgenWorkerClient(DESCRIPTORS)!;
    const batch = [{ id: 'a' }] as any;
    client.prepare(batch);

    const first = client.extract(batch[0]);
    ackInit(fakeWorkers[0]);
    await Promise.resolve();
    const { id } = fakeWorkers[0].posted.find((m) => m.type === 'extract') as { id: number };
    fakeWorkers[0].emit('message', { type: 'extract', id } satisfies DocgenWorkerResponse);
    await first;
    fakeWorkers[0].emit('error', new Error('worker ran out of memory'));

    client.extract(batch[0]).catch(() => undefined);

    expect(fakeWorkers[1].posted[1]).toEqual({ type: 'prepare', entries: batch });
  });
});
