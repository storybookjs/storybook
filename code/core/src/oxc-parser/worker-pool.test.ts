// Unit tests for the worker-pool dispatch / failure / dispose / refcount plumbing. A real
// worker is substituted with an EventEmitter stand-in so the tests stay hermetic.
import type { EventEmitter } from 'node:events';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeMsg {
  id: number;
  filePath: string;
  source: string;
}

interface FakeWorkerHook {
  onPostMessage?: (msg: FakeMsg) => void;
}

interface FakeWorker extends EventEmitter {
  terminated: boolean;
  hook: FakeWorkerHook;
  postMessage: ReturnType<typeof vi.fn>;
  terminate: ReturnType<typeof vi.fn>;
  unref: ReturnType<typeof vi.fn>;
  ref: ReturnType<typeof vi.fn>;
}

const fakeWorkers: FakeWorker[] = [];
let constructorThrowAt = -1;

vi.mock('node:worker_threads', async () => {
  const { EventEmitter: NodeEventEmitter } = await import('node:events');

  class FakeWorkerImpl extends NodeEventEmitter {
    terminated = false;
    hook: FakeWorkerHook = {};
    constructor() {
      super();
      if (constructorThrowAt === fakeWorkers.length) {
        throw new Error(`fake constructor failure at index ${constructorThrowAt}`);
      }
      fakeWorkers.push(this as unknown as FakeWorker);
    }
    postMessage = vi.fn((msg: FakeMsg) => {
      if (this.hook.onPostMessage) {
        this.hook.onPostMessage(msg);
        return;
      }
      queueMicrotask(() => {
        this.emit('message', {
          id: msg.id,
          ok: true,
          edges: [{ specifier: `edge-for:${msg.filePath}`, kind: 'static' }],
        });
      });
    });
    terminate = vi.fn(async () => {
      this.terminated = true;
      return 0;
    });
    unref = vi.fn();
    ref = vi.fn();
  }

  return { Worker: FakeWorkerImpl };
});

vi.mock('node:fs', () => ({ existsSync: () => true }));

vi.mock('storybook/internal/node-logger', { spy: true });

const loadModule = async () => await import('./worker-pool.ts');

describe('OxcWorkerPool', () => {
  beforeEach(() => {
    fakeWorkers.length = 0;
    constructorThrowAt = -1;
  });

  afterEach(async () => {
    const mod = await loadModule();
    await mod._resetOxcParsePoolForTesting();
    vi.resetModules();
    fakeWorkers.length = 0;
  });

  it('dispatches parses through the fake worker and returns edges', async () => {
    const { OxcWorkerPool } = await loadModule();
    const pool = new OxcWorkerPool('/fake/script.js', 2);

    const edges = await pool.parse('/src/a.ts', 'import "x";');

    expect(edges).toEqual([{ specifier: 'edge-for:/src/a.ts', kind: 'static' }]);
    await pool.dispose();
  });

  it('serialises tasks when all workers are busy and releases slots on response', async () => {
    const { OxcWorkerPool } = await loadModule();
    const pool = new OxcWorkerPool('/fake/script.js', 1);

    const [a, b, c] = await Promise.all([
      pool.parse('/src/a.ts', 'x'),
      pool.parse('/src/b.ts', 'x'),
      pool.parse('/src/c.ts', 'x'),
    ]);

    expect(a[0].specifier).toBe('edge-for:/src/a.ts');
    expect(b[0].specifier).toBe('edge-for:/src/b.ts');
    expect(c[0].specifier).toBe('edge-for:/src/c.ts');
    await pool.dispose();
  });

  it('rejects in-flight parses on dispose', async () => {
    const { OxcWorkerPool } = await loadModule();
    const pool = new OxcWorkerPool('/fake/script.js', 1);

    fakeWorkers[0].hook.onPostMessage = () => {
      // never echoes — task will sit pending until dispose
    };

    const pending = pool.parse('/src/stuck.ts', 'x');
    await pool.dispose();
    await expect(pending).rejects.toThrow(/disposed/);
  });

  it('rejects all in-flight tasks and disposes the pool when a worker errors', async () => {
    const { OxcWorkerPool, getOxcParsePool } = await loadModule();
    const pool = new OxcWorkerPool('/fake/script.js', 2, 0); // disable timeout

    // Both workers hang so tasks stay in flight.
    fakeWorkers[0].hook.onPostMessage = () => {};
    fakeWorkers[1].hook.onPostMessage = () => {};

    const taskA = pool.parse('/src/a.ts', 'x');
    const taskB = pool.parse('/src/b.ts', 'x');

    fakeWorkers[0].emit('error', new Error('boom'));

    await expect(taskA).rejects.toThrow(/oxc-worker failure: boom/);
    await expect(taskB).rejects.toThrow(/oxc-worker failure: boom/);

    // Subsequent parse() on the now-disposed pool fails fast.
    await expect(pool.parse('/src/c.ts', 'x')).rejects.toThrow(/disposed/);
  });

  it('rejects victim entries when a worker emits exit unexpectedly', async () => {
    const { OxcWorkerPool } = await loadModule();
    const pool = new OxcWorkerPool('/fake/script.js', 1, 0);

    fakeWorkers[0].hook.onPostMessage = () => {
      /* never echoes */
    };

    const pending = pool.parse('/src/a.ts', 'x');
    fakeWorkers[0].emit('exit', 137);
    await expect(pending).rejects.toThrow(/oxc-worker exit/);
    await pool.dispose();
  });

  it('terminates already-spawned workers when constructor throws partway', async () => {
    const { OxcWorkerPool } = await loadModule();
    constructorThrowAt = 2; // fail on third construction
    expect(() => new OxcWorkerPool('/fake/script.js', 4)).toThrow(/fake constructor failure/);
    // Two workers were spawned before the throw; both must be terminated.
    expect(fakeWorkers.length).toBe(2);
    expect(fakeWorkers.every((w) => w.terminate.mock.calls.length > 0)).toBe(true);
  });

  it('times out hung tasks at the configured per-task timeout', async () => {
    const { OxcWorkerPool } = await loadModule();
    const pool = new OxcWorkerPool('/fake/script.js', 1, 50);

    fakeWorkers[0].hook.onPostMessage = () => {
      /* hang */
    };

    const pending = pool.parse('/src/hang.ts', 'x');
    await expect(pending).rejects.toThrow(/timed out/);
    await pool.dispose();
  });

  it('dispose() rejects pending parse() callers before terminate() completes (H1 regression)', async () => {
    const { OxcWorkerPool } = await loadModule();
    const pool = new OxcWorkerPool('/fake/script.js', 2, 0);

    // Make both workers hang — tasks will sit in pending until dispose.
    fakeWorkers[0].hook.onPostMessage = () => {};
    fakeWorkers[1].hook.onPostMessage = () => {};

    // Override terminate() to return a never-resolving promise to simulate a hung worker.
    const neverResolve = new Promise<number>(() => {});
    fakeWorkers[0].terminate.mockReturnValue(neverResolve);
    fakeWorkers[1].terminate.mockReturnValue(neverResolve);

    const p1 = pool.parse('/src/a.ts', 'x');
    const p2 = pool.parse('/src/b.ts', 'x');

    // Race: parse rejections should win against a 100 ms timeout even though terminate() hangs.
    const rejected = Promise.all([p1.catch((e) => e), p2.catch((e) => e)]);
    const timeout = new Promise<'timeout'>((res) => setTimeout(() => res('timeout'), 100));

    pool.dispose(); // intentionally not awaited — terminate() hangs
    const result = await Promise.race([rejected, timeout]);

    expect(result).not.toBe('timeout');
    const [e1, e2] = result as [Error, Error];
    expect(e1.message).toMatch(/disposed/);
    expect(e2.message).toMatch(/disposed/);
  });

  it('getOxcParsePool returns the same instance on repeated calls; dispose tears it down and fresh instance is created on next call', async () => {
    const { getOxcParsePool, disposeOxcParsePool } = await loadModule();
    const pool = getOxcParsePool();
    expect(pool).not.toBeNull();
    // Repeated calls return the same instance without re-creating.
    expect(getOxcParsePool()).toBe(pool);
    // After dispose, the next call creates a fresh pool (lazy re-init).
    await disposeOxcParsePool();
    const fresh = getOxcParsePool();
    expect(fresh).not.toBeNull();
    expect(fresh).not.toBe(pool);
    await disposeOxcParsePool();
  });
});
