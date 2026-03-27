import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ModuleNode as StorybookModuleNode, Options } from 'storybook/internal/types';
import type { ViteDevServer } from 'vite';

import { bail, onModuleGraphChange, start } from './index';
import { buildModuleGraph } from './utils/build-module-graph';
import { createViteServer } from './vite-server';

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

function getFirstNode(
  file: string,
  moduleGraph: ReturnType<typeof buildModuleGraph>
): StorybookModuleNode {
  const moduleNode = moduleGraph.get(file)?.values().next().value;
  if (!moduleNode) {
    throw new Error(`Expected module node for ${file}`);
  }
  return moduleNode;
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

describe('buildModuleGraph', () => {
  it('converts vite module nodes into the shared module graph shape', () => {
    const entry = createViteModuleNode('/src/entry.ts');
    const component = createViteModuleNode('/src/component.ts');
    const styles = createViteModuleNode('/src/component.css', 'css');

    entry.importedModules.add(component);
    component.importers.add(entry);
    component.importedModules.add(styles);
    styles.importers.add(component);

    const moduleGraph = buildModuleGraph(
      createFileToModulesMap(
        ['/src/entry.ts', new Set([entry])],
        ['/src/component.ts', new Set([component])],
        ['/src/component.css', new Set([styles])]
      )
    );

    const entryNode = getFirstNode('/src/entry.ts', moduleGraph);
    const componentNode = getFirstNode('/src/component.ts', moduleGraph);
    const styleNode = getFirstNode('/src/component.css', moduleGraph);

    expect(entryNode.file).toBe('/src/entry.ts');
    expect(componentNode.type).toBe('js');
    expect(styleNode.type).toBe('css');

    expect(entryNode.importedModules).toEqual(new Set([componentNode]));
    expect(componentNode.importers).toEqual(new Set([entryNode]));
    expect(componentNode.importedModules).toEqual(new Set([styleNode]));
    expect(styleNode.importers).toEqual(new Set([componentNode]));
  });

  it('reuses the same converted node identity across relationships', () => {
    const shared = createViteModuleNode('/src/shared.ts');
    const importerA = createViteModuleNode('/src/a.ts');
    const importerB = createViteModuleNode('/src/b.ts');

    importerA.importedModules.add(shared);
    importerB.importedModules.add(shared);
    shared.importers.add(importerA);
    shared.importers.add(importerB);

    const moduleGraph = buildModuleGraph(
      createFileToModulesMap(
        ['/src/shared.ts', new Set([shared])],
        ['/src/a.ts', new Set([importerA])],
        ['/src/b.ts', new Set([importerB])]
      )
    );

    const sharedNode = getFirstNode('/src/shared.ts', moduleGraph);
    const importerANode = getFirstNode('/src/a.ts', moduleGraph);
    const importerBNode = getFirstNode('/src/b.ts', moduleGraph);

    expect(importerANode.importedModules.has(sharedNode)).toBe(true);
    expect(importerBNode.importedModules.has(sharedNode)).toBe(true);
    expect(sharedNode.importers).toEqual(new Set([importerANode, importerBNode]));
  });

  it('skips related vite module nodes without a file', () => {
    const entry = createViteModuleNode('/src/entry.ts');
    const virtualModule = createViteModuleNode(null);

    entry.importedModules.add(virtualModule);
    virtualModule.importers.add(entry);

    const moduleGraph = buildModuleGraph(
      createFileToModulesMap(['/src/entry.ts', new Set([entry])])
    );
    const entryNode = getFirstNode('/src/entry.ts', moduleGraph);

    expect(moduleGraph.size).toBe(1);
    expect(entryNode.importedModules.size).toBe(0);
  });

  it('keeps multiple module identities for the same file', () => {
    const clientModule = createViteModuleNode('/src/shared.ts');
    const ssrModule = createViteModuleNode('/src/shared.ts');

    const moduleGraph = buildModuleGraph(
      createFileToModulesMap(['/src/shared.ts', new Set([clientModule, ssrModule])])
    );

    expect(moduleGraph.get('/src/shared.ts')?.size).toBe(2);
  });
});

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

    const moduleGraph = cb.mock.calls[0]?.[0];

    expect(cb).toHaveBeenCalledWith(expect.any(Map));
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
});
