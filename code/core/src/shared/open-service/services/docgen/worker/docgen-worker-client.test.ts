// Unit tests for the docgen worker client's dispatch / readiness / failure plumbing. A real worker is
// replaced with an EventEmitter stand-in so the tests stay hermetic.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocgenProviderDescriptor } from '../types.ts';
import type { DocgenWorkerRequest, DocgenWorkerResponse } from './protocol.ts';

/** Only the surface the tests touch; the runtime instance is a real Node EventEmitter subclass. */
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
    constructor() {
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
  // Include a drive letter so `fileURLToPath()` accepts it on Windows too (a driveless file URL
  // throws ERR_INVALID_FILE_URL_PATH there, which would make the client resolve to undefined).
  importMetaResolve: vi.fn(() => 'file:///C:/fake/storybook/docgen-worker.js'),
}));

vi.mock('storybook/internal/node-logger', { spy: true });

const loadModule = async () => import('./docgen-worker-client.ts');

const DESCRIPTORS: DocgenProviderDescriptor[] = [
  { moduleSpecifier: '/fake/react/docgen-worker.js' },
];

/** Resolve the worker's `init` ack so awaiting `extract` calls can proceed. */
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

  it('spawns the worker lazily on the first extract and posts init with descriptors', async () => {
    const { createDocgenWorkerClient } = await loadModule();
    const client = createDocgenWorkerClient(DESCRIPTORS)!;

    const promise = client.extract({ id: 'button--primary' } as any);
    const worker = fakeWorkers[0];

    expect(fakeWorkers).toHaveLength(1);
    expect(worker.posted[0]).toEqual({ type: 'init', descriptors: DESCRIPTORS });
    // The worker stays referenced through init, so a static build cannot exit before a slow
    // extraction finishes.
    expect(worker.unref).not.toHaveBeenCalled();

    // Drive the extract to completion so dispose isn't racing a not-yet-queued request.
    ackInit(worker);
    await Promise.resolve();
    const extractMsg = worker.posted.find((m) => m.type === 'extract') as { id: number };
    // Referenced while the extraction is in flight (a transient unref may precede it when the
    // ready-settled rebalance runs before the extract continuation - microtasks cannot drain the
    // event loop, so only the final order matters).
    expect(worker.ref).toHaveBeenCalled();
    worker.emit('message', {
      type: 'extract',
      id: extractMsg.id,
      payload: { id: 'button', name: 'Button', path: './button.stories.tsx', jsDocTags: {} },
    } satisfies DocgenWorkerResponse);
    await expect(promise).resolves.toMatchObject({ id: 'button' });
    // ...and released once nothing is pending, so an idle worker never blocks process exit: the
    // LAST lifecycle call must be an unref, after every ref.
    const lastRef = Math.max(...worker.ref.mock.invocationCallOrder);
    const lastUnref = Math.max(...worker.unref.mock.invocationCallOrder);
    expect(lastUnref).toBeGreaterThan(lastRef);

    // Attaching a `message` listener re-references the worker's port, so an unref that ran before
    // the listeners were on would leave the worker holding the event loop open forever. Asserting
    // the order because a unit test cannot observe the process failing to exit.
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

    // Nothing is dispatched until init is acked.
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
    // Worker dies during boot, before its `init` ack - `ready` must reject so the awaiting extract
    // fails fast instead of hanging forever.
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
});
