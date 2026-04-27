// Tests the Vite implementation of ChangeDetectionAdapter — wiring of resolve config
// snapshot and chokidar event normalisation.
import { EventEmitter } from 'node:events';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ViteDevServer } from 'vite';

import { createViteChangeDetectionAdapter } from './index.ts';

vi.mock('vite', { spy: true });

interface FakeViteDevServer {
  config: {
    root: string;
    resolve?: {
      alias?: unknown;
      conditions?: string[];
      tsconfig?: string;
    };
  };
  watcher: EventEmitter;
}

function createFakeServer(overrides: Partial<FakeViteDevServer['config']> = {}): {
  server: ViteDevServer;
  watcher: EventEmitter;
} {
  const watcher = new EventEmitter();
  const server: FakeViteDevServer = {
    config: {
      root: '/repo',
      ...overrides,
    },
    watcher,
  };
  return { server: server as unknown as ViteDevServer, watcher };
}

describe('createViteChangeDetectionAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('snapshots projectRoot, alias and conditions from server.config in getResolveConfig()', async () => {
    const alias = [{ find: '@', replacement: '/repo/src' }];
    const conditions = ['import', 'module', 'default'];
    const { server } = createFakeServer({
      root: '/repo',
      resolve: { alias, conditions },
    });

    const adapter = createViteChangeDetectionAdapter(server);
    const config = await adapter.getResolveConfig();

    expect(config).toEqual({
      projectRoot: '/repo',
      tsconfigPath: undefined,
      alias,
      conditions,
    });
  });

  it('forwards chokidar `add` events as kind: "add"', () => {
    const { server, watcher } = createFakeServer();
    const adapter = createViteChangeDetectionAdapter(server);
    const handler = vi.fn();
    adapter.onFileChange(handler);

    watcher.emit('all', 'add', '/repo/src/A.tsx');

    expect(handler).toHaveBeenCalledWith({ kind: 'add', path: '/repo/src/A.tsx' });
  });

  it('forwards chokidar `change` events as kind: "change"', () => {
    const { server, watcher } = createFakeServer();
    const adapter = createViteChangeDetectionAdapter(server);
    const handler = vi.fn();
    adapter.onFileChange(handler);

    watcher.emit('all', 'change', '/repo/src/A.tsx');

    expect(handler).toHaveBeenCalledWith({ kind: 'change', path: '/repo/src/A.tsx' });
  });

  it('forwards chokidar `unlink` events as kind: "unlink"', () => {
    const { server, watcher } = createFakeServer();
    const adapter = createViteChangeDetectionAdapter(server);
    const handler = vi.fn();
    adapter.onFileChange(handler);

    watcher.emit('all', 'unlink', '/repo/src/A.tsx');

    expect(handler).toHaveBeenCalledWith({ kind: 'unlink', path: '/repo/src/A.tsx' });
  });

  it('does NOT forward `addDir`, `unlinkDir`, `ready`, `raw`, or `error` chokidar events', () => {
    const { server, watcher } = createFakeServer();
    const adapter = createViteChangeDetectionAdapter(server);
    const handler = vi.fn();
    adapter.onFileChange(handler);

    watcher.emit('all', 'addDir', '/repo/src/some-dir');
    watcher.emit('all', 'unlinkDir', '/repo/src/some-dir');
    watcher.emit('all', 'ready');
    watcher.emit('all', 'raw', '/repo/src/A.tsx');
    watcher.emit('all', 'error', new Error('boom'));

    expect(handler).not.toHaveBeenCalled();
  });

  it('normalises chokidar paths via pathe.normalize before forwarding', () => {
    const { server, watcher } = createFakeServer();
    const adapter = createViteChangeDetectionAdapter(server);
    const handler = vi.fn();
    adapter.onFileChange(handler);

    // Path with `/./` and mixed-case noise that pathe.normalize collapses.
    watcher.emit('all', 'change', '/repo/src/./A.tsx');

    expect(handler).toHaveBeenCalledWith({
      kind: 'change',
      path: '/repo/src/A.tsx',
    });
  });

  it('returns an unsubscribe function that removes the listener', () => {
    const { server, watcher } = createFakeServer();
    const adapter = createViteChangeDetectionAdapter(server);
    const handler = vi.fn();
    const unsubscribe = adapter.onFileChange(handler);

    watcher.emit('all', 'change', '/repo/src/A.tsx');
    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();
    watcher.emit('all', 'change', '/repo/src/B.tsx');
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
