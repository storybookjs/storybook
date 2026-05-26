import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { buildServiceArtifacts, patchesToStateDiff } from './build-artifacts.ts';
import { defineService } from './define-service.ts';
import { clearRegistry, getService } from './service-runtime.ts';
import {
  clearStaticTransport,
  createBrowserStaticTransport,
  setStaticTransport,
  type ServiceStaticTransport,
} from './static-transport.ts';
import type { ServiceCtx } from './types.ts';

/** Wait a tick — enough for fire-and-forget loader promises to settle. */
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

afterEach(() => {
  clearRegistry();
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
  it('returns an empty Map for services with no `preload` field', async () => {
    const def = defineService<{ x: number }>()({
      id: 'test/no-loaders',
      state: { x: 1 },
      queries: {
        get: { input: z.void(), output: z.number(), select: (s: { x: number }) => s.x },
      },
      commands: {},
    });

    const artifacts = await buildServiceArtifacts(def);
    expect(artifacts.size).toBe(0);
  });

  it("emits one file per enumerated input via the loader's `path` callback", async () => {
    interface S {
      byId: Record<string, { name: string }>;
    }
    const def = defineService<S>()({
      id: 'test/loader-build',
      state: { byId: {} } as S,
      queries: {
        getOne: {
          input: z.string(),
          output: z.any(),
          select: (s: S, id: string) => s.byId[id],
          preload: async (id: string, ctx: ServiceCtx<S>) => {
            await ctx.self.commands.load(id);
          },
          inputs: ['a', 'b'],
          path: (_ctx: import('./types.ts').BuildCtx, id: string) => `entries/${id}.json`,
        },
      },
      commands: {
        load: {
          input: z.string(),
          output: z.void(),
          handler: async (id: string, ctx: ServiceCtx<S>) => {
            ctx.self.setState((d) => {
              d.byId[id] = { name: `Loaded ${id}` };
            });
          },
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
    const def = defineService<S>()({
      id: 'test/loader-default-path',
      state: { byId: {} } as S,
      queries: {
        getOne: {
          input: z.string(),
          output: z.any(),
          select: (s: S, id: string) => s.byId[id],
          preload: async (id: string, ctx: ServiceCtx<S>) => {
            await ctx.self.commands.load(id);
          },
          inputs: ['x', 'y'],
        },
      },
      commands: {
        load: {
          input: z.string(),
          output: z.void(),
          handler: async (id: string, ctx: ServiceCtx<S>) => {
            ctx.self.setState((d) => {
              d.byId[id] = `name-${id}`;
            });
          },
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
    const def = defineService<S>()({
      id: 'test/single-file',
      state: { byId: {} } as S,
      queries: {
        // A no-input preload: paired with a "whole" query; produces a single file.
        allStatuses: {
          input: z.void(),
          output: z.any(),
          select: (s: S) => s.byId,
          preload: async (ctx: ServiceCtx<S>) => {
            await ctx.self.commands.loadAll();
          },
          path: () => 'statuses.json',
        },
      },
      commands: {
        loadAll: {
          input: z.void(),
          output: z.void(),
          handler: async (ctx: ServiceCtx<S>) => {
            ctx.self.setState((d) => {
              d.byId = { 'story-1': 'pass', 'story-2': 'fail' };
            });
          },
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
    const def = defineService<S>()({
      id: 'test/shared-path',
      state: { cats: {}, dogs: {} } as S,
      queries: {
        allCats: {
          input: z.void(),
          output: z.any(),
          select: (s: S) => s.cats,
          preload: async (ctx: ServiceCtx<S>) => {
            await ctx.self.commands.loadCats();
          },
          path: () => 'pets.json',
        },
        allDogs: {
          input: z.void(),
          output: z.any(),
          select: (s: S) => s.dogs,
          preload: async (ctx: ServiceCtx<S>) => {
            await ctx.self.commands.loadDogs();
          },
          path: () => 'pets.json',
        },
      },
      commands: {
        loadCats: {
          input: z.void(),
          output: z.void(),
          handler: async (ctx: ServiceCtx<S>) => {
            ctx.self.setState((d) => {
              d.cats = { whiskers: true, mittens: true };
            });
          },
        },
        loadDogs: {
          input: z.void(),
          output: z.void(),
          handler: async (ctx: ServiceCtx<S>) => {
            ctx.self.setState((d) => {
              d.dogs = { rex: true };
            });
          },
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
    const def = defineService<S>()({
      id: 'test/array-index-rejected',
      state: { items: [] },
      queries: {
        getItems: {
          input: z.void(),
          output: z.any(),
          select: (s: S) => s.items,
          preload: async (ctx: ServiceCtx<S>) => {
            await ctx.self.commands.push(1);
          },
        },
      },
      commands: {
        push: {
          input: z.number(),
          output: z.void(),
          handler: async (n: number, ctx: ServiceCtx<S>) => {
            ctx.self.setState((d) => {
              d.items.push(n);
            });
          },
        },
      },
    });

    await expect(buildServiceArtifacts(def)).rejects.toThrow(/array-index patch/);
  });

  it('hashes non-string inputs into a deterministic filename when no `path` is provided', async () => {
    interface S {
      byKey: Record<string, string>;
    }
    const keySchema = z.object({ kind: z.string(), id: z.number() });
    const def = defineService<S>()({
      id: 'test/hashed-default-path',
      state: { byKey: {} },
      queries: {
        getByKey: {
          input: keySchema,
          output: z.string(),
          select: (s: S, k: z.infer<typeof keySchema>) => s.byKey[`${k.kind}:${k.id}`],
          preload: async (k: z.infer<typeof keySchema>, ctx: ServiceCtx<S>) => {
            ctx.self.setState((d: S) => {
              d.byKey[`${k.kind}:${k.id}`] = `${k.kind}-${k.id}`;
            });
          },
          inputs: [
            { kind: 'cat', id: 1 },
            { kind: 'cat', id: 1 }, // duplicate — should map to the same file, merged
            { kind: 'dog', id: 2 },
          ],
        },
      },
      commands: {},
    });

    const artifacts = await buildServiceArtifacts(def);
    const filenames = [...artifacts.keys()].sort();

    // Two distinct objects → two files, each `getByKey-<8 hex chars>.json`.
    expect(filenames).toHaveLength(2);
    expect(filenames[0]).toMatch(/^getByKey-[0-9a-f]{8}\.json$/);
    expect(filenames[1]).toMatch(/^getByKey-[0-9a-f]{8}\.json$/);
    expect(filenames[0]).not.toBe(filenames[1]);
  });

  it('reads preload+inputs+path from inline query definitions on definition.queries', async () => {
    interface S {
      byId: Record<string, { name: string }>;
    }
    const def = defineService<S>()({
      id: 'test/query-object-form',
      state: { byId: {} } as S,
      queries: {
        getOne: {
          input: z.string(),
          output: z.any(),
          select: (s: S, id: string) => s.byId[id],
          preload: async (id: string, ctx: ServiceCtx<S>) => {
            await ctx.self.commands.load(id);
          },
          inputs: ['a', 'b'],
          path: (_ctx: import('./types.ts').BuildCtx, id: string) => `entries/${id}.json`,
        },
      },
      commands: {
        load: {
          input: z.string(),
          output: z.void(),
          handler: async (id: string, ctx: ServiceCtx<S>) => {
            ctx.self.setState((d) => {
              d.byId[id] = { name: `loaded ${id}` };
            });
          },
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
    const def = defineService<S>()({
      id: 'test/query-object-no-input',
      state: { byId: {} } as S,
      queries: {
        allStatuses: {
          input: z.void(),
          output: z.any(),
          select: (s: S) => s.byId,
          preload: async (ctx: ServiceCtx<S>) => {
            await ctx.self.commands.loadAll();
          },
          path: () => 'statuses.json',
        },
      },
      commands: {
        loadAll: {
          input: z.void(),
          output: z.void(),
          handler: async (ctx: ServiceCtx<S>) => {
            ctx.self.setState((d) => {
              d.byId = { 'story-1': 'pass', 'story-2': 'fail' };
            });
          },
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
    const def = defineService<S>()({
      id: 'test/loader-enumerate-fn',
      state: { byId: {} } as S,
      queries: {
        getOne: {
          input: z.string(),
          output: z.any(),
          select: (s: S, id: string): true | undefined => s.byId[id],
          preload: async (id: string, ctx: ServiceCtx<S>) => {
            await ctx.self.commands.load(id);
          },
          inputs: async () => ['p', 'q', 'r'],
        },
      },
      commands: {
        load: {
          input: z.string(),
          output: z.void(),
          handler: async (id: string, ctx: ServiceCtx<S>) => {
            ctx.self.setState((d) => {
              d.byId[id] = true;
            });
          },
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
    const def = defineService<S>()({
      id: 'test/loader-live',
      state: { byId: {} } as S,
      queries: {
        getOne: {
          input: z.string(),
          output: z.any(),
          select: (s: S, id: string) => s.byId[id],
          preload: async (id: string, ctx: ServiceCtx<S>) => {
            await ctx.self.commands.load(id);
          },
          inputs: ['a'],
        },
      },
      commands: {
        load: {
          input: z.string(),
          output: z.void(),
          handler: async (id: string, ctx: ServiceCtx<S>) => {
            realLoadCalls.push(id);
            ctx.self.setState((d) => {
              d.byId[id] = `live-${id}`;
            });
          },
        },
      },
    });

    const store = getService(def);
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
    const def = defineService<S>()({
      id: 'test/loader-static',
      state: { byId: {} } as S,
      queries: {
        getOne: {
          input: z.string(),
          output: z.any(),
          select: (s: S, id: string) => s.byId[id],
          preload: async (id: string, ctx: ServiceCtx<S>) => {
            await ctx.self.commands.load(id);
          },
          inputs: ['a'],
          path: (_c: import('./types.ts').BuildCtx, id: string) => `entries/${id}.json`,
        },
      },
      commands: {
        load: {
          input: z.string(),
          output: z.void(),
          handler: async (id: string, ctx: ServiceCtx<S>) => {
            realLoadCalls.push(id);
            ctx.self.setState((d) => {
              d.byId[id] = `live-${id}`;
            });
          },
        },
      },
    });

    const transport = mockTransport();
    // State-shaped diff (not an Immer patch list).
    transport.files.set(`${def.id}/entries/a.json`, { byId: { a: 'from-static' } });
    setStaticTransport(transport);

    const store = getService(def);
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
    const def = defineService<S>()({
      id: 'test/loader-static-fallback',
      state: { byId: {} } as S,
      queries: {
        getOne: {
          input: z.string(),
          output: z.any(),
          select: (s: S, id: string) => s.byId[id],
          preload: async (id: string, ctx: ServiceCtx<S>) => {
            await ctx.self.commands.load(id);
          },
          inputs: ['a'],
        },
      },
      commands: {
        load: {
          input: z.string(),
          output: z.void(),
          handler: async (id: string, ctx: ServiceCtx<S>) => {
            realLoadCalls.push(id);
            ctx.self.setState((d) => {
              d.byId[id] = `live-${id}`;
            });
          },
        },
      },
    });

    // Transport installed but has no entry for this input — fetch returns null.
    setStaticTransport(mockTransport());

    const store = getService(def);
    store.queries.getOne.subscribe('a', vi.fn());

    await tick();

    expect(realLoadCalls).toEqual(['a']); // body did run as fallback
    expect(store.queries.getOne('a')).toBe('live-a');
  });

  it('loader files are lazy: no fetch until a query is subscribed/called', async () => {
    interface S {
      byId: Record<string, string>;
    }
    const def = defineService<S>()({
      id: 'test/loader-lazy',
      state: { byId: {} } as S,
      queries: {
        getOne: {
          input: z.string(),
          output: z.any(),
          select: (s: S, id: string) => s.byId[id],
          preload: async (id: string, ctx: ServiceCtx<S>) => {
            await ctx.self.commands.load(id);
          },
          inputs: ['a', 'b', 'c'],
          path: (_c: import('./types.ts').BuildCtx, id: string) => `entries/${id}.json`,
        },
      },
      commands: {
        load: {
          input: z.string(),
          output: z.void(),
          handler: async (id: string, ctx: ServiceCtx<S>) => {
            ctx.self.setState((d) => {
              d.byId[id] = `live-${id}`;
            });
          },
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
    getService(def);
    expect(fetched).toEqual([]);

    // Subscribing to 'a' triggers exactly one fetch — entries/a.json.
    const store = getService(def);
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
    const def = defineService<S>()({
      id: 'test/roundtrip-docgen',
      state: { byComponentId: {} } as S,
      queries: {
        getComponentDocgenInfo: {
          input: z.string(),
          output: z.any(),
          select: (s: S, id: string) => s.byComponentId[id],
          preload: async (id: string, ctx: ServiceCtx<S>) => {
            await ctx.self.commands.generate(id);
          },
          inputs: ['Button', 'Tabs'],
          path: (_c: import('./types.ts').BuildCtx, id: string) => `docgen-${id}.json`,
        },
      },
      commands: {
        generate: {
          input: z.string(),
          output: z.void(),
          handler: async (id: string, ctx: ServiceCtx<S>) => {
            realLoadCalls.push(id);
            ctx.self.setState((d) => {
              d.byComponentId[id] = { description: `Docgen for ${id}` };
            });
          },
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
    const reloaded = getService(def);

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
    const def = defineService<S>()({
      id: 'test/roundtrip-single-file',
      state: { byStoryId: {} } as S,
      queries: {
        allStatuses: {
          input: z.void(),
          output: z.any(),
          select: (s: S) => s.byStoryId,
          preload: async (ctx: ServiceCtx<S>) => {
            await ctx.self.commands.loadAll();
          },
          path: () => 'statuses.json',
        },
        getStoryStatus: {
          input: z.string(),
          output: z.any(),
          select: (s: S, id: string) => s.byStoryId[id],
        },
      },
      commands: {
        loadAll: {
          input: z.void(),
          output: z.void(),
          handler: async (ctx: ServiceCtx<S>) => {
            realLoadCalls.push(realLoadCalls.length + 1);
            ctx.self.setState((d) => {
              d.byStoryId = { 'story-1': 'pass', 'story-2': 'fail' };
            });
          },
        },
      },
    });

    const artifacts = await buildServiceArtifacts(def);
    expect([...artifacts.keys()]).toEqual(['statuses.json']);
    expect(realLoadCalls).toEqual([1]); // body ran once during the build

    realLoadCalls.length = 0;
    installTransportFromArtifacts(def.id, artifacts);
    const reloaded = getService(def);

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

// -------------------- defensive fixes (PR #34912 review) --------------------

describe('build-time input validation (Fix #3)', () => {
  it('emits artifacts keyed off the *parsed* input, not the raw enumerated value', async () => {
    interface S {
      byId: Record<string, { name: string }>;
    }
    const def = defineService<S>()({
      id: 'test/build-input-validation',
      state: { byId: {} } as S,
      queries: {
        getOne: {
          // `transform` mutates the input — the build must run inputs through this so the
          // artifact filename matches what the runtime will request after its own validation.
          input: z.string().transform((s) => s.toUpperCase()),
          output: z.any(),
          select: (s: S, id: string) => s.byId[id],
          preload: async (id: string, ctx: ServiceCtx<S>) => {
            ctx.self.setState((d) => {
              d.byId[id] = { name: `Loaded ${id}` };
            });
          },
          inputs: ['abc'],
          path: (_ctx, id: string) => `entries/${id}.json`,
        },
      },
      commands: {},
    });

    const artifacts = await buildServiceArtifacts(def);
    expect([...artifacts.keys()]).toEqual(['entries/ABC.json']);
  });
});

describe('resolvePreloadInputs guard (Fix #4)', () => {
  it('throws when an input-keyed preload omits `inputs`', async () => {
    interface S {
      byId: Record<string, { name: string }>;
    }
    const def = defineService<S>()({
      id: 'test/preload-missing-inputs',
      state: { byId: {} } as S,
      queries: {
        getOne: {
          input: z.string(),
          output: z.any(),
          select: (s: S, id: string) => s.byId[id],
          // Input-keyed preload arity (id, ctx) — but no `inputs: [...]` enumeration. The
          // build can't guess what to pre-render, so this is an authoring bug and must throw.
          preload: async (id: string, ctx: ServiceCtx<S>) => {
            ctx.self.setState((d) => {
              d.byId[id] = { name: `Loaded ${id}` };
            });
          },
          path: (_ctx, id: string) => `entries/${id}.json`,
        },
      },
      commands: {},
    });

    await expect(buildServiceArtifacts(def)).rejects.toThrow(/input-keyed preload but no `inputs`/);
  });

  it('keeps the [undefined] fallback for no-input preloads', async () => {
    interface S {
      list: number[];
    }
    const def = defineService<S>()({
      id: 'test/preload-no-input-fallback',
      state: { list: [] } as S,
      queries: {
        getAll: {
          input: z.void(),
          output: z.any(),
          select: (s: S) => s.list,
          // No-input preload arity (ctx only) — the [undefined] fallback is correct.
          preload: async (ctx: ServiceCtx<S>) => {
            ctx.self.setState((d) => {
              d.list = [1, 2, 3];
            });
          },
          path: () => 'all.json',
        },
      },
      commands: {},
    });

    const artifacts = await buildServiceArtifacts(def);
    expect([...artifacts.keys()]).toEqual(['all.json']);
  });
});

describe('patchesToStateDiff guards (Fixes #7, #10)', () => {
  // These guards can't be triggered through the public API today — Immer's `setState`
  // implementation discards the recipe's return value (no root-replacement is possible
  // through `setState((d) => ({...}))`), and Immer blocks `setPrototypeOf` on drafts so
  // a preload can't write `draft.__proto__ = ...`. The guards exist to document the
  // wire-format contract: if a synthetic or hand-written diff ever feeds in via a future
  // codepath (artifact replay, manual patch construction), prototype pollution or
  // root-clobbering can't slip through.

  it('throws on a root-replacement patch (empty path) [Fix #7]', () => {
    expect(() =>
      patchesToStateDiff([{ op: 'replace', path: [], value: { v: 1 } }], 'svc', 'q')
    ).toThrow(/root-replacement patch/);
  });

  it('throws on an unsafe `__proto__` segment [Fix #10]', () => {
    expect(() =>
      patchesToStateDiff(
        [{ op: 'add', path: ['byId', '__proto__'], value: { polluted: true } }],
        'svc',
        'q'
      )
    ).toThrow(/unsafe key/);
  });

  it('throws on an unsafe `constructor` segment [Fix #10]', () => {
    expect(() =>
      patchesToStateDiff([{ op: 'add', path: ['constructor'], value: 'evil' }], 'svc', 'q')
    ).toThrow(/unsafe key/);
  });

  it('throws on an unsafe `prototype` segment anywhere in the path [Fix #10]', () => {
    expect(() =>
      patchesToStateDiff([{ op: 'add', path: ['a', 'prototype', 'b'], value: 1 }], 'svc', 'q')
    ).toThrow(/unsafe key/);
  });

  it('passes through safe paths', () => {
    expect(
      patchesToStateDiff(
        [
          { op: 'add', path: ['byId', 'a'], value: { name: 'alpha' } },
          { op: 'replace', path: ['byId', 'b', 'name'], value: 'BETA' },
        ],
        'svc',
        'q'
      )
    ).toEqual({
      byId: { a: { name: 'alpha' }, b: { name: 'BETA' } },
    });
  });
});

describe('createBrowserStaticTransport status handling (Fix #5)', () => {
  const originalFetch = (globalThis as { fetch?: typeof fetch }).fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    (globalThis as { fetch?: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    if (originalFetch) {
      (globalThis as { fetch?: typeof fetch }).fetch = originalFetch;
    } else {
      delete (globalThis as { fetch?: typeof fetch }).fetch;
    }
  });

  it('returns null on 404 (artifact not present, fall through to live)', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));
    const t = createBrowserStaticTransport();
    await expect(t.fetch('svc', 'all.json')).resolves.toBeNull();
  });

  it('returns null on 410 (artifact permanently gone)', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 410 }));
    const t = createBrowserStaticTransport();
    await expect(t.fetch('svc', 'all.json')).resolves.toBeNull();
  });

  it('throws on 500 so server errors do not silently fall through to live data', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
    const t = createBrowserStaticTransport();
    await expect(t.fetch('svc', 'all.json')).rejects.toThrow(/returned 500/);
  });

  it('throws on 502 (upstream proxy errors must not be masked)', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 502 }));
    const t = createBrowserStaticTransport();
    await expect(t.fetch('svc', 'all.json')).rejects.toThrow(/returned 502/);
  });

  it('returns parsed JSON on 200', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    const t = createBrowserStaticTransport();
    await expect(t.fetch('svc', 'all.json')).resolves.toEqual({ ok: true });
  });
});
