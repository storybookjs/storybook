import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';
import type { ModuleNode as StorybookModuleNode, Options } from 'storybook/internal/types';
import type { ViteDevServer } from 'vite';

import { bail, onModuleGraphChange, start } from './index';
import { createViteServer } from './vite-server';

vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('./vite-server', { spy: true });

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
    warmupRequest: vi.fn().mockResolvedValue(undefined),
    transformIndexHtml: vi.fn().mockResolvedValue(''),
    waitForRequestsIdle: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  } as unknown as ViteDevServer & {
    watcher: typeof watcher;
  };
}

function createStartArgs(storyImportPaths: string[] = []): Parameters<typeof start>[0] {
  const indexGenerator = {
    getIndex: vi.fn().mockResolvedValue({
      entries: Object.fromEntries(
        storyImportPaths.map((importPath, index) => [`story-${index}`, { importPath }])
      ),
    }),
  };

  return {
    startTime: process.hrtime(),
    options: {
      presets: {
        apply: vi.fn().mockResolvedValue(indexGenerator),
      },
    } as unknown as Options,
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

  async function startChangeDetection(
    fileToModulesMap = createFileToModulesMap([
      '/src/Button.tsx',
      new Set([createViteModuleNode('/src/Button.tsx')]),
    ])
  ) {
    fakeViteServer.moduleGraph.fileToModulesMap = fileToModulesMap;
    await start(createStartArgs([...fileToModulesMap.keys()]));
    await vi.advanceTimersByTimeAsync(1000);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    fakeViteServer = createFakeViteServer();
    vi.mocked(createViteServer).mockResolvedValue(fakeViteServer);
    vi.mocked(logger.error).mockImplementation(() => undefined);
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

    await startChangeDetection();
    cb.mockClear();

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
    const fileToModulesMap = createFileToModulesMap(['/src/Button.tsx', new Set([entry])]);

    const cb = vi.fn();
    onModuleGraphChange(cb);

    await startChangeDetection(fileToModulesMap);
    cb.mockClear();

    fakeViteServer.watcher.emit('change', '/src/Button.tsx');

    await vi.advanceTimersByTimeAsync(100);

    const event = cb.mock.calls[0]?.[0];
    const moduleGraph = event?.moduleGraph;

    expect(cb).toHaveBeenCalledWith({
      type: 'moduleGraph',
      moduleGraph: expect.any(Map),
    });
    expect(moduleGraph?.has('/src/Button.tsx')).toBe(true);
  });

  it('triggers change events after the debounce delay', async () => {
    const cb = vi.fn();
    onModuleGraphChange(cb);

    await startChangeDetection();
    cb.mockClear();

    fakeViteServer.watcher.emit('change', '/src/Button.tsx');

    await vi.advanceTimersByTimeAsync(50);
    expect(cb).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(50);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('triggers add events after the debounce delay', async () => {
    const cb = vi.fn();
    onModuleGraphChange(cb);

    await startChangeDetection();
    cb.mockClear();

    fakeViteServer.watcher.emit('add', '/src/Button.tsx');

    await vi.advanceTimersByTimeAsync(100);

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('triggers unlink events after the debounce delay', async () => {
    const cb = vi.fn();
    onModuleGraphChange(cb);

    await startChangeDetection();
    cb.mockClear();

    fakeViteServer.watcher.emit('unlink', '/src/Button.tsx');

    await vi.advanceTimersByTimeAsync(100);

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('debounces multiple rapid events into a single callback', async () => {
    const cb = vi.fn();
    onModuleGraphChange(cb);

    await startChangeDetection();
    cb.mockClear();

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

    await startChangeDetection();
    cb1.mockClear();
    cb2.mockClear();

    fakeViteServer.watcher.emit('change', '/src/Button.tsx');

    await vi.advanceTimersByTimeAsync(100);

    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it('removes the all-event watcher during bail to avoid leaks across restarts', async () => {
    const cb = vi.fn();
    onModuleGraphChange(cb);

    await startChangeDetection();
    expect(fakeViteServer.watcher.listenerCount('all')).toBe(1);

    await bail();
    expect(fakeViteServer.watcher.listenerCount('all')).toBe(0);

    await start(createStartArgs(['/src/Button.tsx']));
    await vi.advanceTimersByTimeAsync(1000);
    expect(fakeViteServer.watcher.listenerCount('all')).toBe(0);

    fakeViteServer.watcher.emit('change', '/src/Button.tsx');
    await vi.advanceTimersByTimeAsync(100);

    expect(cb).not.toHaveBeenCalled();
    expect(fakeViteServer.watcher.off).toHaveBeenCalledWith('all', expect.any(Function));
  });

  it('clears the module-graph polling interval during bail', async () => {
    onModuleGraphChange(vi.fn());

    await start(createStartArgs());
    await vi.advanceTimersByTimeAsync(0);

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

  it('rejects listeners registered after start', async () => {
    await start(createStartArgs());

    expect(() => onModuleGraphChange(vi.fn())).toThrow(
      'Vite module graph listeners must be registered before the builder starts.'
    );
  });

  it('does not reattach the watcher if bail runs while waiting for idle requests', async () => {
    const cb = vi.fn();
    onModuleGraphChange(cb);

    let resolveIdle: (() => void) | undefined;
    fakeViteServer.moduleGraph.fileToModulesMap = createFileToModulesMap([
      '/src/Button.tsx',
      new Set([createViteModuleNode('/src/Button.tsx')]),
    ]);
    fakeViteServer.waitForRequestsIdle = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveIdle = resolve;
        })
    );

    await start(createStartArgs(['/src/Button.tsx']));
    await vi.advanceTimersByTimeAsync(1000);

    await bail();
    resolveIdle?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(fakeViteServer.watcher.listenerCount('all')).toBe(0);
    expect(fakeViteServer.watcher.on).not.toHaveBeenCalledWith('all', expect.any(Function));
    expect(cb).not.toHaveBeenCalled();
  });

  it('logs and swallows rejected startup work', async () => {
    const cb = vi.fn();
    onModuleGraphChange(cb);

    const args = createStartArgs();
    vi.mocked(args.options.presets.apply).mockResolvedValue({
      getIndex: vi.fn().mockRejectedValue(new Error('index failed')),
    } as never);

    await expect(start(args)).resolves.toBeDefined();
    await Promise.resolve();

    expect(logger.error).toHaveBeenCalledWith('Failed to initialize Vite change detection');
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ message: 'index failed' }));
    expect(cb).toHaveBeenCalledWith({
      type: 'error',
      error: expect.objectContaining({ message: 'index failed' }),
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('logs polling failures and clears the interval', async () => {
    const cb = vi.fn();
    onModuleGraphChange(cb);
    fakeViteServer.moduleGraph.fileToModulesMap = createFileToModulesMap([
      '/src/Button.tsx',
      new Set([createViteModuleNode('/src/Button.tsx')]),
    ]);
    fakeViteServer.waitForRequestsIdle = vi.fn().mockRejectedValue(new Error('idle failed'));

    await start(createStartArgs(['/src/Button.tsx']));
    await vi.advanceTimersByTimeAsync(1000);

    expect(logger.error).toHaveBeenCalledWith('Failed to complete Vite change detection startup');
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ message: 'idle failed' }));
    expect(cb).toHaveBeenCalledWith({
      type: 'error',
      error: expect.objectContaining({ message: 'idle failed' }),
    });
    expect(vi.getTimerCount()).toBe(0);
    expect(fakeViteServer.watcher.listenerCount('all')).toBe(0);
  });

  it('notifies listeners when module graph startup times out', async () => {
    const cb = vi.fn();
    onModuleGraphChange(cb);

    await start(createStartArgs(['/src/Button.tsx']));
    await vi.advanceTimersByTimeAsync(31_000);

    expect(logger.error).toHaveBeenCalledWith('Failed to complete Vite change detection startup');
    expect(cb).toHaveBeenCalledWith({
      type: 'unavailable',
      reason: 'Timed out while waiting for the Vite module graph to initialize',
      error: expect.objectContaining({
        message: 'Timed out while waiting for the Vite module graph to initialize',
      }),
    });
    expect(vi.getTimerCount()).toBe(0);
  });
});
