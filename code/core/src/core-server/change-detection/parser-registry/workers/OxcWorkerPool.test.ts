// Unit tests for the pool's dispatch/dispose plumbing. A real worker is substituted with
// an EventEmitter stand-in so the test is hermetic and fast; the worker-script path
// integration is covered by the real parse tests in builtins.test.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:worker_threads', async () => {
  const { EventEmitter } = await import('node:events');
  class FakeWorker extends EventEmitter {
    terminated = false;
    postMessage = vi.fn((msg: { id: number; filePath: string; source: string }) => {
      // Synchronously echo a successful parse response on the next microtask.
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
  return { Worker: FakeWorker };
});

vi.mock('node:fs', () => ({ existsSync: () => true }));

vi.mock('storybook/internal/node-logger', { spy: true });

// Import AFTER mocks so the module picks up the fake Worker.
const loadModule = async () => await import('./OxcWorkerPool.ts');

describe('OxcWorkerPool', () => {
  beforeEach(() => {
    delete process.env.STORYBOOK_CHANGE_DETECTION_NO_WORKER;
    delete process.env.STORYBOOK_CHANGE_DETECTION_WORKERS;
  });

  afterEach(async () => {
    const mod = await loadModule();
    await mod.disposeOxcParsePool();
    vi.resetModules();
  });

  it('dispatches parses through the fake worker and returns edges', async () => {
    process.env.STORYBOOK_CHANGE_DETECTION_WORKERS = '2';
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

    // Monkey-patch the fake worker to swallow its response so the task stays pending
    // until dispose.
    const anyPool = pool as unknown as { workers: Array<{ worker: { postMessage: unknown } }> };
    anyPool.workers[0].worker.postMessage = vi.fn(); // no-op — never echoes

    const pending = pool.parse('/src/stuck.ts', 'x');
    await pool.dispose();
    await expect(pending).rejects.toThrow(/disposed/);
  });

  it('disables the shared pool when STORYBOOK_CHANGE_DETECTION_NO_WORKER is set', async () => {
    process.env.STORYBOOK_CHANGE_DETECTION_NO_WORKER = '1';
    const { getOxcParsePool } = await loadModule();
    expect(getOxcParsePool()).toBeNull();
  });
});
