import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ModuleNode as StorybookModuleNode, Options } from 'storybook/internal/types';
import type { ViteDevServer } from 'vite';

import { bail, onModuleGraphChange, start } from './index.ts';
import { createViteServer } from './vite-server.ts';

vi.mock('./vite-server', () => ({
  createViteServer: vi.fn(),
}));

type ViteModuleNodeLike = {
  file: string | null;
  type: StorybookModuleNode['type'];
  importers: Set<ViteModuleNodeLike>;
  importedModules: Set<ViteModuleNodeLike>;
};

function createViteModuleNode(
  file: string | null,
  type: StorybookModuleNode['type'] = 'js'
): ViteModuleNodeLike {
  return {
    file,
    type,
    importers: new Set(),
    importedModules: new Set(),
  };
}

function createFileToModulesMap(...entries: Array<[string, Set<ViteModuleNodeLike>]>) {
  return new Map(entries) as ViteDevServer['moduleGraph']['fileToModulesMap'];
}

type WatcherHandler = (...args: unknown[]) => void;
type FakeWatcher = {
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  emit: (event: string, ...args: unknown[]) => void;
  listenerCount: (event: string) => number;
};

function createFakeViteServer() {
  const watcherListeners = new Map<string, Set<WatcherHandler>>();
  const watcher = {} as FakeWatcher;

  watcher.on = vi.fn((event: string, handler: WatcherHandler) => {
    const handlers = watcherListeners.get(event) ?? new Set<WatcherHandler>();
    handlers.add(handler);
    watcherListeners.set(event, handlers);
    return watcher;
  });
  watcher.off = vi.fn((event: string, handler: WatcherHandler) => {
    watcherListeners.get(event)?.delete(handler);
    return watcher;
  });
  watcher.emit = (event: string, ...args: unknown[]) => {
    watcherListeners.get(event)?.forEach((handler) => {
      handler(...args);
    });
    watcherListeners.get('all')?.forEach((handler) => {
      handler(event, ...args);
    });
  };
  watcher.listenerCount = (event: string) => watcherListeners.get(event)?.size ?? 0;

  return {
    watcher,
    moduleGraph: {
      fileToModulesMap: createFileToModulesMap(),
    },
    middlewares: {
      handle: vi.fn(),
    },
    transformIndexHtml: vi.fn().mockResolvedValue(''),
    waitForRequestsIdle: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  } as unknown as ViteDevServer & {
    watcher: typeof watcher;
  };
}

function createStartArgs(): Parameters<typeof start>[0] {
  return {
    startTime: process.hrtime(),
    options: {} as Options,
    router: {
      get: vi.fn(),
      use: vi.fn(),
    } as unknown as Parameters<typeof start>[0]['router'],
    server: {} as Parameters<typeof start>[0]['server'],
    channel: {} as Parameters<typeof start>[0]['channel'],
  };
}

describe('onModuleGraphChange', () => {
  let fakeViteServer: ReturnType<typeof createFakeViteServer>;

  beforeEach(() => {
    vi.useFakeTimers();
    fakeViteServer = createFakeViteServer();
    vi.mocked(createViteServer).mockResolvedValue(fakeViteServer);
  });

  afterEach(async () => {
    await bail();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('registers callbacks and unsubscribes them', async () => {
    const cb = vi.fn();
    const unsubscribe = onModuleGraphChange(cb);

    expect(unsubscribe).toEqual(expect.any(Function));

    await start(createStartArgs());
    fakeViteServer.watcher.emit('change', '/src/Button.tsx');

    await vi.advanceTimersByTimeAsync(100);

    expect(cb).toHaveBeenCalledTimes(1);

    unsubscribe();

    fakeViteServer.watcher.emit('change', '/src/Button.tsx');
    await vi.advanceTimersByTimeAsync(100);

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('passes the module graph payload to listeners', async () => {
    const entry = createViteModuleNode('/src/Button.tsx');
    fakeViteServer.moduleGraph.fileToModulesMap = createFileToModulesMap([
      '/src/Button.tsx',
      new Set([entry]),
    ]);

    const cb = vi.fn();
    onModuleGraphChange(cb);

    await start(createStartArgs());
    fakeViteServer.watcher.emit('change', '/src/Button.tsx');

    await vi.advanceTimersByTimeAsync(100);

    const moduleGraph = cb.mock.calls[0]?.[0];

    expect(cb).toHaveBeenCalledWith(expect.any(Map));
    expect(moduleGraph?.has('/src/Button.tsx')).toBe(true);
  });

  it('triggers change events after the debounce delay', async () => {
    const cb = vi.fn();
    onModuleGraphChange(cb);

    await start(createStartArgs());
    fakeViteServer.watcher.emit('change', '/src/Button.tsx');

    await vi.advanceTimersByTimeAsync(50);
    expect(cb).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(50);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('triggers add events after the debounce delay', async () => {
    const cb = vi.fn();
    onModuleGraphChange(cb);

    await start(createStartArgs());
    fakeViteServer.watcher.emit('add', '/src/Button.tsx');

    await vi.advanceTimersByTimeAsync(100);

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('triggers unlink events after the debounce delay', async () => {
    const cb = vi.fn();
    onModuleGraphChange(cb);

    await start(createStartArgs());
    fakeViteServer.watcher.emit('unlink', '/src/Button.tsx');

    await vi.advanceTimersByTimeAsync(100);

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('debounces multiple rapid events into a single callback', async () => {
    const cb = vi.fn();
    onModuleGraphChange(cb);

    await start(createStartArgs());
    fakeViteServer.watcher.emit('change', '/src/Button.tsx');
    fakeViteServer.watcher.emit('add', '/src/Button.tsx');
    fakeViteServer.watcher.emit('change', '/src/Button.tsx');

    await vi.advanceTimersByTimeAsync(100);

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('notifies multiple listeners', async () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    onModuleGraphChange(cb1);
    onModuleGraphChange(cb2);

    await start(createStartArgs());
    fakeViteServer.watcher.emit('change', '/src/Button.tsx');

    await vi.advanceTimersByTimeAsync(100);

    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it('removes the all-event watcher during bail to avoid leaks across restarts', async () => {
    const cb = vi.fn();
    onModuleGraphChange(cb);

    await start(createStartArgs());
    expect(fakeViteServer.watcher.listenerCount('all')).toBe(1);

    await bail();
    expect(fakeViteServer.watcher.listenerCount('all')).toBe(0);

    await start(createStartArgs());
    expect(fakeViteServer.watcher.listenerCount('all')).toBe(1);

    fakeViteServer.watcher.emit('change', '/src/Button.tsx');
    await vi.advanceTimersByTimeAsync(100);

    expect(cb).not.toHaveBeenCalled();
    expect(fakeViteServer.watcher.off).toHaveBeenCalledWith('all', expect.any(Function));
  });

  it('clears the module-graph polling interval during bail', async () => {
    await start(createStartArgs());

    expect(vi.getTimerCount()).toBe(1);

    await bail();

    fakeViteServer.moduleGraph.fileToModulesMap = createFileToModulesMap([
      '/src/Button.tsx',
      new Set([createViteModuleNode('/src/Button.tsx')]),
    ]);

    await vi.advanceTimersByTimeAsync(1000);

    expect(vi.getTimerCount()).toBe(0);
    expect(fakeViteServer.waitForRequestsIdle).not.toHaveBeenCalled();
  });
});
