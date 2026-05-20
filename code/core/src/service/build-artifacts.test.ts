import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildServiceArtifacts } from './build-artifacts.ts';
import { defineQuery, defineService } from './define-service.ts';
import { __resetServiceRegistry, registerService } from './register-service.ts';
import {
  clearStaticTransport,
  setStaticTransport,
  type ServiceStaticTransport,
} from './static-transport.ts';
import type { ServiceCtx } from './types.ts';

/** Wait a tick — enough for fire-and-forget loader promises to settle. */
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

afterEach(() => {
  __resetServiceRegistry();
  clearStaticTransport();
});

/**
 * Map-backed transport. Files are keyed by `${serviceId}/${filename}`, matching what
 * `transport.fetch(serviceId, filename)` receives.
 */
function mockTransport(files: Map<string, unknown> = new Map()): ServiceStaticTransport & {
  files: Map<string, unknown>;
} {
  return {
    files,
    fetch: async (serviceId, filename) => {
      const key = `${serviceId}/${filename}`;
      return files.has(key) ? files.get(key) : null;
    },
  };
}

/** Install a transport whose contents come from a `buildServiceArtifacts` result. */
function installTransportFromArtifacts(
  serviceId: string,
  artifacts: Map<string, unknown>
): ServiceStaticTransport {
  const files = new Map<string, unknown>();
  for (const [filename, value] of artifacts) {
    files.set(`${serviceId}/${filename}`, value);
  }
  const transport = mockTransport(files);
  setStaticTransport(transport);
  return transport;
}

// -------------------- writer --------------------

describe('buildServiceArtifacts', () => {
  it('returns an empty Map for services with no `load` field', async () => {
    const def = defineService<{ x: number }>()({
      id: 'test/no-loaders',
      state: { x: 1 },
      queries: { get: (s) => s.x },
      commands: {},
    });

    const artifacts = await buildServiceArtifacts(def);
    expect(artifacts.size).toBe(0);
  });

  it("emits one file per enumerated input via the loader's `path` callback", async () => {
    interface S {
      byId: Record<string, { name: string }>;
    }
    const def = defineService({
      id: 'test/loader-build',
      state: { byId: {} } as S,
      queries: {
        getOne: defineQuery({
          select: (s: S, id: string) => s.byId[id],
          preload: async (id: string, ctx: ServiceCtx<S>) => {
            await ctx.self.commands.load(id);
          },
          inputs: ['a', 'b'],
          path: (_ctx, id: string) => `entries/${id}.json`,
        }),
      },
      commands: {
        load: async (id: string, ctx: ServiceCtx<S>) => {
          ctx.self.setState((d) => {
            d.byId[id] = { name: `Loaded ${id}` };
          });
        },
      },
    });

    const artifacts = await buildServiceArtifacts(def);

    expect([...artifacts.keys()].sort()).toEqual(['entries/a.json', 'entries/b.json']);
    // Files are state-shaped diffs (JSON-Merge-Patch flavour), not Immer patch lists.
    expect(artifacts.get('entries/a.json')).toEqual({
      byId: { a: { name: 'Loaded a' } },
    });
    expect(artifacts.get('entries/b.json')).toEqual({
      byId: { b: { name: 'Loaded b' } },
    });
  });

  it('defaults the filename when no `path` callback is supplied', async () => {
    interface S {
      byId: Record<string, string>;
    }
    const def = defineService({
      id: 'test/loader-default-path',
      state: { byId: {} } as S,
      queries: {
        getOne: defineQuery({
          select: (s: S, id: string) => s.byId[id],
          preload: async (id: string, ctx: ServiceCtx<S>) => {
            await ctx.self.commands.load(id);
          },
          inputs: ['x', 'y'],
        }),
      },
      commands: {
        load: async (id: string, ctx: ServiceCtx<S>) => {
          ctx.self.setState((d) => {
            d.byId[id] = `name-${id}`;
          });
        },
      },
    });

    const artifacts = await buildServiceArtifacts(def);
    expect([...artifacts.keys()].sort()).toEqual(['getOne-x.json', 'getOne-y.json']);
  });

  it('supports a no-input loader (a single-file service)', async () => {
    interface S {
      byId: Record<string, string>;
    }
    const def = defineService({
      id: 'test/single-file',
      state: { byId: {} } as S,
      queries: {
        // A no-input preload: paired with a "whole" query; produces a single file.
        allStatuses: defineQuery({
          select: (s: S) => s.byId,
          preload: async (ctx: ServiceCtx<S>) => {
            await ctx.self.commands.loadAll();
          },
          path: () => 'statuses.json',
        }),
      },
      commands: {
        loadAll: async (ctx: ServiceCtx<S>) => {
          ctx.self.setState((d) => {
            d.byId = { 'story-1': 'pass', 'story-2': 'fail' };
          });
        },
      },
    });

    const artifacts = await buildServiceArtifacts(def);
    expect([...artifacts.keys()]).toEqual(['statuses.json']);
    expect(artifacts.get('statuses.json')).toEqual({
      byId: { 'story-1': 'pass', 'story-2': 'fail' },
    });
  });

  it('deep-merges when multiple loader-input pairs resolve to the same filename', async () => {
    // Two loaders sharing one file. Each writes a disjoint slice; the build merges them.
    interface S {
      cats: Record<string, true>;
      dogs: Record<string, true>;
    }
    const def = defineService({
      id: 'test/shared-path',
      state: { cats: {}, dogs: {} } as S,
      queries: {
        allCats: defineQuery({
          select: (s: S) => s.cats,
          preload: async (ctx: ServiceCtx<S>) => {
            await ctx.self.commands.loadCats();
          },
          path: () => 'pets.json',
        }),
        allDogs: defineQuery({
          select: (s: S) => s.dogs,
          preload: async (ctx: ServiceCtx<S>) => {
            await ctx.self.commands.loadDogs();
          },
          path: () => 'pets.json',
        }),
      },
      commands: {
        loadCats: async (ctx: ServiceCtx<S>) => {
          ctx.self.setState((d) => {
            d.cats = { whiskers: true, mittens: true };
          });
        },
        loadDogs: async (ctx: ServiceCtx<S>) => {
          ctx.self.setState((d) => {
            d.dogs = { rex: true };
          });
        },
      },
    });

    const artifacts = await buildServiceArtifacts(def);
    expect([...artifacts.keys()]).toEqual(['pets.json']);
    // The two loaders' diffs deep-merged into one artifact.
    expect(artifacts.get('pets.json')).toEqual({
      cats: { whiskers: true, mittens: true },
      dogs: { rex: true },
    });
  });

  it('rejects array-index patches (state should be record-shaped)', async () => {
    interface S {
      items: number[];
    }
    const def = defineService({
      id: 'test/array-index-rejected',
      state: { items: [] } as S,
      queries: {
        getItems: defineQuery({
          select: (s: S) => s.items,
          preload: async (ctx: ServiceCtx<S>) => {
            await ctx.self.commands.push(1);
          },
        }),
      },
      commands: {
        push: async (n: number, ctx: ServiceCtx<S>) => {
          ctx.self.setState((d) => {
            d.items.push(n);
          });
        },
      },
    });

    await expect(buildServiceArtifacts(def)).rejects.toThrow(/array-index patch/);
  });

  it('reads preload+inputs+path from a defineQuery on definition.queries (new form)', async () => {
    interface S {
      byId: Record<string, { name: string }>;
    }
    const def = defineService({
      id: 'test/query-object-form',
      state: { byId: {} } as S,
      queries: {
        getOne: defineQuery({
          select: (s: S, id: string) => s.byId[id],
          preload: async (id: string, ctx: ServiceCtx<S>) => {
            await ctx.self.commands.load(id);
          },
          inputs: ['a', 'b'],
          path: (_ctx, id: string) => `entries/${id}.json`,
        }),
      },
      commands: {
        load: async (id: string, ctx: ServiceCtx<S>) => {
          ctx.self.setState((d) => {
            d.byId[id] = { name: `loaded ${id}` };
          });
        },
      },
    });

    const artifacts = await buildServiceArtifacts(def);

    // Files are state-shaped diffs, identical shape to the legacy-loader case.
    expect([...artifacts.keys()].sort()).toEqual(['entries/a.json', 'entries/b.json']);
    expect(artifacts.get('entries/a.json')).toEqual({
      byId: { a: { name: 'loaded a' } },
    });
    expect(artifacts.get('entries/b.json')).toEqual({
      byId: { b: { name: 'loaded b' } },
    });
  });

  it('reads a no-input query-object preload (single-file pattern, new form)', async () => {
    interface S {
      byId: Record<string, string>;
    }
    const def = defineService({
      id: 'test/query-object-no-input',
      state: { byId: {} } as S,
      queries: {
        allStatuses: defineQuery({
          select: (s: S) => s.byId,
          preload: async (ctx: ServiceCtx<S>) => {
            await ctx.self.commands.loadAll();
          },
          path: () => 'statuses.json',
        }),
      },
      commands: {
        loadAll: async (ctx: ServiceCtx<S>) => {
          ctx.self.setState((d) => {
            d.byId = { 'story-1': 'pass', 'story-2': 'fail' };
          });
        },
      },
    });

    const artifacts = await buildServiceArtifacts(def);
    expect([...artifacts.keys()]).toEqual(['statuses.json']);
    expect(artifacts.get('statuses.json')).toEqual({
      byId: { 'story-1': 'pass', 'story-2': 'fail' },
    });
  });

  it('resolves enumerateInputs when given as an async function', async () => {
    interface S {
      byId: Record<string, true>;
    }
    const def = defineService({
      id: 'test/loader-enumerate-fn',
      state: { byId: {} } as S,
      queries: {
        getOne: defineQuery({
          select: (s: S, id: string) => s.byId[id],
          preload: async (id: string, ctx: ServiceCtx<S>) => {
            await ctx.self.commands.load(id);
          },
          inputs: async () => ['p', 'q', 'r'],
        }),
      },
      commands: {
        load: async (id: string, ctx: ServiceCtx<S>) => {
          ctx.self.setState((d) => {
            d.byId[id] = true;
          });
        },
      },
    });

    const artifacts = await buildServiceArtifacts(def);
    expect([...artifacts.keys()].sort()).toEqual([
      'getOne-p.json',
      'getOne-q.json',
      'getOne-r.json',
    ]);
  });
});

// -------------------- runtime loader branching --------------------

describe('runtime loader branching', () => {
  it('runs the loader body live when no transport is installed', async () => {
    interface S {
      byId: Record<string, string>;
    }
    const realLoadCalls: string[] = [];
    const def = defineService({
      id: 'test/loader-live',
      state: { byId: {} } as S,
      queries: {
        getOne: defineQuery({
          select: (s: S, id: string) => s.byId[id],
          preload: async (id: string, ctx: ServiceCtx<S>) => {
            await ctx.self.commands.load(id);
          },
          inputs: ['a'],
        }),
      },
      commands: {
        load: async (id: string, ctx: ServiceCtx<S>) => {
          realLoadCalls.push(id);
          ctx.self.setState((d) => {
            d.byId[id] = `live-${id}`;
          });
        },
      },
    });

    const store = registerService(def);
    const listener = vi.fn();
    store.queries.getOne.subscribe('a', listener);

    await tick();

    expect(realLoadCalls).toEqual(['a']);
    expect(listener).toHaveBeenCalledWith('live-a');
  });

  it('fetches the loader file and applies patches when transport is installed; body is NOT called', async () => {
    interface S {
      byId: Record<string, string>;
    }
    const realLoadCalls: string[] = [];
    const def = defineService({
      id: 'test/loader-static',
      state: { byId: {} } as S,
      queries: {
        getOne: defineQuery({
          select: (s: S, id: string) => s.byId[id],
          preload: async (id: string, ctx: ServiceCtx<S>) => {
            await ctx.self.commands.load(id);
          },
          inputs: ['a'],
          path: (_c, id: string) => `entries/${id}.json`,
        }),
      },
      commands: {
        load: async (id: string, ctx: ServiceCtx<S>) => {
          realLoadCalls.push(id);
          ctx.self.setState((d) => {
            d.byId[id] = `live-${id}`;
          });
        },
      },
    });

    const transport = mockTransport();
    // State-shaped diff (not an Immer patch list).
    transport.files.set(`${def.id}/entries/a.json`, { byId: { a: 'from-static' } });
    setStaticTransport(transport);

    const store = registerService(def);
    const listener = vi.fn();
    store.queries.getOne.subscribe('a', listener);

    await tick();

    expect(realLoadCalls).toEqual([]); // body never ran
    expect(listener).toHaveBeenCalledWith('from-static');
    expect(store.queries.getOne('a')).toBe('from-static');
  });

  it('falls back to running the body when the transport returns null for that input', async () => {
    interface S {
      byId: Record<string, string>;
    }
    const realLoadCalls: string[] = [];
    const def = defineService({
      id: 'test/loader-static-fallback',
      state: { byId: {} } as S,
      queries: {
        getOne: defineQuery({
          select: (s: S, id: string) => s.byId[id],
          preload: async (id: string, ctx: ServiceCtx<S>) => {
            await ctx.self.commands.load(id);
          },
          inputs: ['a'],
        }),
      },
      commands: {
        load: async (id: string, ctx: ServiceCtx<S>) => {
          realLoadCalls.push(id);
          ctx.self.setState((d) => {
            d.byId[id] = `live-${id}`;
          });
        },
      },
    });

    // Transport installed but has no entry for this input — fetch returns null.
    setStaticTransport(mockTransport());

    const store = registerService(def);
    store.queries.getOne.subscribe('a', vi.fn());

    await tick();

    expect(realLoadCalls).toEqual(['a']); // body did run as fallback
    expect(store.queries.getOne('a')).toBe('live-a');
  });

  it('loader files are lazy: no fetch until a query is subscribed/called', async () => {
    interface S {
      byId: Record<string, string>;
    }
    const def = defineService({
      id: 'test/loader-lazy',
      state: { byId: {} } as S,
      queries: {
        getOne: defineQuery({
          select: (s: S, id: string) => s.byId[id],
          preload: async (id: string, ctx: ServiceCtx<S>) => {
            await ctx.self.commands.load(id);
          },
          inputs: ['a', 'b', 'c'],
          path: (_c, id: string) => `entries/${id}.json`,
        }),
      },
      commands: {
        load: async (id: string, ctx: ServiceCtx<S>) => {
          ctx.self.setState((d) => {
            d.byId[id] = `live-${id}`;
          });
        },
      },
    });

    // Track every fetch call by filename.
    const fetched: string[] = [];
    const files = new Map<string, unknown>();
    files.set(`${def.id}/entries/a.json`, { byId: { a: 'static-a' } });
    files.set(`${def.id}/entries/b.json`, { byId: { b: 'static-b' } });
    files.set(`${def.id}/entries/c.json`, { byId: { c: 'static-c' } });
    setStaticTransport({
      fetch: async (serviceId, filename) => {
        const key = `${serviceId}/${filename}`;
        fetched.push(filename);
        return files.has(key) ? files.get(key)! : null;
      },
    });

    // Registration triggers no fetches — the runtime no longer fetches at registration.
    registerService(def);
    expect(fetched).toEqual([]);

    // Subscribing to 'a' triggers exactly one fetch — entries/a.json.
    const store = registerService(def);
    store.queries.getOne.subscribe('a', vi.fn());
    await tick();
    expect(fetched).toEqual(['entries/a.json']);

    // Subscribing to 'b' triggers entries/b.json. Still nothing for 'c'.
    store.queries.getOne.subscribe('b', vi.fn());
    await tick();
    expect(fetched).toEqual(['entries/a.json', 'entries/b.json']);

    // A second subscription for 'a' does NOT re-fetch.
    store.queries.getOne.subscribe('a', vi.fn());
    await tick();
    expect(fetched).toEqual(['entries/a.json', 'entries/b.json']);
  });
});

// -------------------- round trip --------------------

describe('build → load round trip', () => {
  it('docgen-style per-id round trip', async () => {
    interface S {
      byComponentId: Record<string, { description: string }>;
    }
    const realLoadCalls: string[] = [];
    const def = defineService({
      id: 'test/roundtrip-docgen',
      state: { byComponentId: {} } as S,
      queries: {
        getComponentDocgenInfo: defineQuery({
          select: (s: S, id: string) => s.byComponentId[id],
          preload: async (id: string, ctx: ServiceCtx<S>) => {
            await ctx.self.commands.generate(id);
          },
          inputs: ['Button', 'Tabs'],
          path: (_c, id: string) => `docgen-${id}.json`,
        }),
      },
      commands: {
        generate: async (id: string, ctx: ServiceCtx<S>) => {
          realLoadCalls.push(id);
          ctx.self.setState((d) => {
            d.byComponentId[id] = { description: `Docgen for ${id}` };
          });
        },
      },
    });

    // Build: enumerates inputs, runs each in a sandbox, captures patches.
    const artifacts = await buildServiceArtifacts(def);
    expect(realLoadCalls.sort()).toEqual(['Button', 'Tabs']);
    expect([...artifacts.keys()].sort()).toEqual(['docgen-Button.json', 'docgen-Tabs.json']);

    // Reload via transport. The loader body must NOT run again.
    realLoadCalls.length = 0;
    installTransportFromArtifacts(def.id, artifacts);
    const reloaded = registerService(def);

    const listener = vi.fn();
    reloaded.queries.getComponentDocgenInfo.subscribe('Button', listener);
    await tick();

    expect(realLoadCalls).toEqual([]);
    expect(reloaded.queries.getComponentDocgenInfo('Button')).toEqual({
      description: 'Docgen for Button',
    });
    expect(listener).toHaveBeenCalledWith({ description: 'Docgen for Button' });
  });

  it('single-file service round trip (StoryStatusService-shaped)', async () => {
    interface S {
      byStoryId: Record<string, string>;
    }
    const realLoadCalls: number[] = [];
    const def = defineService({
      id: 'test/roundtrip-single-file',
      state: { byStoryId: {} } as S,
      queries: {
        allStatuses: defineQuery({
          select: (s: S) => s.byStoryId,
          preload: async (ctx: ServiceCtx<S>) => {
            await ctx.self.commands.loadAll();
          },
          path: () => 'statuses.json',
        }),
        getStoryStatus: (s: S, id: string) => s.byStoryId[id],
      },
      commands: {
        loadAll: async (ctx: ServiceCtx<S>) => {
          realLoadCalls.push(realLoadCalls.length + 1);
          ctx.self.setState((d) => {
            d.byStoryId = { 'story-1': 'pass', 'story-2': 'fail' };
          });
        },
      },
    });

    const artifacts = await buildServiceArtifacts(def);
    expect([...artifacts.keys()]).toEqual(['statuses.json']);
    expect(realLoadCalls).toEqual([1]); // body ran once during the build

    realLoadCalls.length = 0;
    installTransportFromArtifacts(def.id, artifacts);
    const reloaded = registerService(def);

    // First subscription to `allStatuses` fires the loader, which fetches statuses.json.
    const listener = vi.fn();
    reloaded.queries.allStatuses.subscribe(listener);
    await tick();

    expect(realLoadCalls).toEqual([]); // body never ran post-build
    expect(reloaded.queries.allStatuses()).toEqual({
      'story-1': 'pass',
      'story-2': 'fail',
    });
    expect(listener).toHaveBeenCalledWith({ 'story-1': 'pass', 'story-2': 'fail' });

    // After the load lands, the derived `getStoryStatus` query reads from the populated state.
    expect(reloaded.queries.getStoryStatus('story-1')).toBe('pass');
  });
});
