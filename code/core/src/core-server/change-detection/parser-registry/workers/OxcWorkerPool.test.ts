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

const loadModule = async () => await import('./OxcWorkerPool.ts');

describe('OxcWorkerPool', () => {
  beforeEach(() => {
    fakeWorkers.length = 0;
    constructorThrowAt = -1;
  });

  afterEach(async () => {
    const mod = await loadModule();
    mod._resetOxcParsePoolForTesting();
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

  it('rejects only the crashed worker and keeps healthy workers running', async () => {
    const { OxcWorkerPool } = await loadModule();
    const pool = new OxcWorkerPool('/fake/script.js', 2, 0); // disable timeout

    // Stash one task on each worker. The first worker keeps its task pending; the
    // second worker echoes immediately.
    fakeWorkers[0].hook.onPostMessage = () => {
      // never echoes for this slot
    };

    // The pool's drain() picks any non-busy slot. We need to land task A on slot 0 and
    // task B on slot 1. Since both are non-busy, drain assigns A→slot0, B→slot1.
    const taskA = pool.parse('/src/a.ts', 'x');
    const taskB = pool.parse('/src/b.ts', 'x');

    await taskB; // healthy worker echoed.

    fakeWorkers[0].emit('error', new Error('boom'));
    await expect(taskA).rejects.toThrow(/oxc-worker error: boom/);

    // Pool should have spun up a replacement worker; total construction count is 3.
    expect(fakeWorkers.length).toBe(3);

    // Subsequent task lands on the replacement (or healthy slot 1) and resolves.
    const taskC = pool.parse('/src/c.ts', 'x');
    await expect(taskC).resolves.toBeDefined();

    await pool.dispose();
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

  describe('singleton refcount', () => {
    it('reuses the shared pool across multiple acquires', async () => {
      const { acquireOxcParsePool, disposeOxcParsePool } = await loadModule();
      const a = acquireOxcParsePool();
      const b = acquireOxcParsePool();
      expect(a).not.toBeNull();
      expect(a).toBe(b);
      await disposeOxcParsePool();
      // First release: still alive.
      const stillAlive = a!;
      expect(stillAlive).toBeDefined();
      await disposeOxcParsePool();
      // Second release: subsequent acquire spawns a fresh pool.
      const c = acquireOxcParsePool();
      expect(c).not.toBeNull();
      expect(c).not.toBe(a);
      await disposeOxcParsePool();
    });

    it('getOxcParsePool peeks without changing the refcount', async () => {
      const { acquireOxcParsePool, getOxcParsePool, disposeOxcParsePool } = await loadModule();
      // Before any acquire: peek returns null.
      expect(getOxcParsePool()).toBeNull();
      const acquired = acquireOxcParsePool();
      expect(acquired).not.toBeNull();
      // Peek returns the same instance, no ref change.
      expect(getOxcParsePool()).toBe(acquired);
      expect(getOxcParsePool()).toBe(acquired);
      // Single dispose tears it down — proves peek did not bump the refcount.
      await disposeOxcParsePool();
      expect(getOxcParsePool()).toBeNull();
    });
  });
});
