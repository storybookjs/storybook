import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  STATE_ARTIFACT_NAME,
  buildServiceArtifacts,
  buildServiceArtifactsFromRuntime,
} from './build-artifacts.ts';
import { defineLoader, defineService } from './define-service.ts';
import { __resetServiceRegistry, registerService } from './register-service.ts';
import { ServiceRuntime } from './service-runtime.ts';
import {
  clearStaticTransport,
  setStaticTransport,
  type ServiceStaticTransport,
} from './static-transport.ts';
import type { ServiceCtx } from './types.ts';

afterEach(() => {
  __resetServiceRegistry();
  clearStaticTransport();
});

/**
 * Map-backed transport. The test populates `files` keyed by `${serviceId}/${filename}` —
 * matching what the architecture-level transport receives — and the runtime calls
 * `fetch(serviceId, filename)` to retrieve them.
 *
 * Mirrors the shape of a production transport built via `createBrowserStaticTransport`,
 * which composes the same key from the same two pieces and asks `window.fetch` for it.
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

/**
 * Helper: install a transport whose contents come from a `buildServiceArtifacts` result.
 * The build returns `Map<filename, value>`; the transport stores them under
 * `${serviceId}/${filename}` for retrieval.
 */
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

describe('buildServiceArtifacts (write)', () => {
  it('emits state.json by default, containing the full state', async () => {
    interface S {
      x: number;
      nested: { y: string };
    }
    const def = defineService<S>()({
      id: 'test/build-default',
      state: { x: 7, nested: { y: 'hello' } },
      queries: { get: (s) => s },
      commands: {},
    });

    const artifacts = await buildServiceArtifacts(def);

    expect([...artifacts.keys()]).toEqual([STATE_ARTIFACT_NAME]);
    expect(artifacts.get(STATE_ARTIFACT_NAME)).toEqual({ x: 7, nested: { y: 'hello' } });
  });

  it('opt-out via `load: false` omits state.json', async () => {
    const def = defineService({
      id: 'test/build-optout',
      state: { x: 1 },
      queries: { get: (s: { x: number }) => s.x },
      commands: {},
      load: false,
    });

    const artifacts = await buildServiceArtifacts(def);
    expect(artifacts.has(STATE_ARTIFACT_NAME)).toBe(false);
    expect(artifacts.size).toBe(0);
  });

  it('buildServiceArtifactsFromRuntime captures post-mutation state', async () => {
    interface S {
      byId: Record<string, string>;
    }
    const def = defineService({
      id: 'test/build-from-runtime',
      state: { byId: {} } as S,
      queries: { get: (s: S, id: string) => s.byId[id] },
      commands: {
        add: (input: { id: string; name: string }, ctx: ServiceCtx<S>) =>
          ctx.self.setState((d) => {
            d.byId[input.id] = input.name;
          }),
      },
    });

    const runtime = new ServiceRuntime(def);
    await runtime.commands.add({ id: 'a', name: 'Alice' });
    await runtime.commands.add({ id: 'b', name: 'Bob' });

    const artifacts = buildServiceArtifactsFromRuntime(runtime);
    expect(artifacts.get(STATE_ARTIFACT_NAME)).toEqual({
      byId: { a: 'Alice', b: 'Bob' },
    });
  });
});

// -------------------- loader --------------------

describe('registration with installed transport (load)', () => {
  it('no transport installed → live mode, no fetch happens', async () => {
    const def = defineService<{ x: number }>()({
      id: 'test/load-no-transport',
      state: { x: 1 },
      queries: { get: (s) => s.x },
      commands: {},
    });

    const store = registerService(def);
    await store.ready;
    expect(store.queries.get()).toBe(1);
  });

  it('transport installed → fetches state.json on registration and deep-merges into state', async () => {
    interface S {
      x: number;
      nested: { y: string; z: number };
    }
    const def = defineService<S>()({
      id: 'test/load-fetches',
      state: { x: 1, nested: { y: 'default', z: 0 } },
      queries: { get: (s) => s },
      commands: {},
    });

    const transport = mockTransport();
    transport.files.set(`${def.id}/${STATE_ARTIFACT_NAME}`, {
      x: 999,
      nested: { y: 'fetched' /* z omitted — should preserve default */ },
    });
    setStaticTransport(transport);

    const store = registerService(def);
    await store.ready;

    expect(store.queries.get()).toEqual({
      x: 999,
      nested: { y: 'fetched', z: 0 },
    });
  });

  it('null/missing state.json leaves the in-memory default intact', async () => {
    const def = defineService<{ x: number }>()({
      id: 'test/load-missing',
      state: { x: 42 },
      queries: { get: (s) => s.x },
      commands: {},
    });

    setStaticTransport(mockTransport()); // empty — fetch returns null
    const store = registerService(def);
    await store.ready;

    expect(store.queries.get()).toBe(42);
  });

  it('query subscribers fire once when the fetched state changes their result', async () => {
    const def = defineService<{ x: number }>()({
      id: 'test/load-notifies-subscribers',
      state: { x: 1 },
      queries: { get: (s) => s.x },
      commands: {},
    });

    const transport = mockTransport();
    transport.files.set(`${def.id}/${STATE_ARTIFACT_NAME}`, { x: 100 });
    setStaticTransport(transport);

    const store = registerService(def);

    const seen: number[] = [];
    store.queries.get.subscribe((v) => {
      seen.push(v);
    });

    await store.ready;
    expect(seen).toEqual([100]);
    expect(store.queries.get()).toBe(100);
  });

  it('opt-out wins over transport: definition.load: false skips the fetch even if the file exists', async () => {
    const def = defineService({
      id: 'test/load-optout-still-works',
      state: { x: 1 },
      queries: { get: (s: { x: number }) => s.x },
      commands: {},
      load: false,
    });

    const transport = mockTransport();
    transport.files.set(`${def.id}/${STATE_ARTIFACT_NAME}`, { x: 9999 });
    setStaticTransport(transport);

    const store = registerService(def);
    await store.ready;
    expect(store.queries.get()).toBe(1);
  });

  it('transport receives the service id and filename separately', async () => {
    const def = defineService<{ x: number }>()({
      id: 'test/transport-args',
      state: { x: 1 },
      queries: { get: (s) => s.x },
      commands: {},
    });

    const calls: Array<{ serviceId: string; filename: string }> = [];
    setStaticTransport({
      fetch: async (serviceId, filename) => {
        calls.push({ serviceId, filename });
        return null;
      },
    });

    const store = registerService(def);
    await store.ready;

    expect(calls).toEqual([{ serviceId: 'test/transport-args', filename: STATE_ARTIFACT_NAME }]);
  });
});

// -------------------- per-loader files (phase 2) --------------------

describe('per-loader artifacts (write)', () => {
  it("emits one JSON file per enumerated input via the loader's path callback", async () => {
    interface S {
      byId: Record<string, { name: string }>;
    }
    const def = defineService({
      id: 'test/loader-build',
      state: { byId: {} } as S,
      queries: {
        getOne: (s: S, id: string) => s.byId[id],
      },
      commands: {
        load: async (id: string, ctx: ServiceCtx<S>) => {
          ctx.self.setState((d) => {
            d.byId[id] = { name: `Loaded ${id}` };
          });
        },
      },
      load: {
        getOne: defineLoader<S, string>(
          async (id, ctx) => {
            await ctx.self.commands.load(id);
          },
          ['a', 'b'],
          { path: (_ctx, id) => `entries/${id}.json` }
        ),
      },
    });

    const artifacts = await buildServiceArtifacts(def);

    expect(artifacts.has(STATE_ARTIFACT_NAME)).toBe(true);
    expect(artifacts.has('entries/a.json')).toBe(true);
    expect(artifacts.has('entries/b.json')).toBe(true);

    // Each file contains the patch list for that input — captured from a fresh sandbox runtime,
    // so it represents only what *this* loader+input pair changed.
    expect(artifacts.get('entries/a.json')).toEqual([
      { op: 'add', path: ['byId', 'a'], value: { name: 'Loaded a' } },
    ]);
    expect(artifacts.get('entries/b.json')).toEqual([
      { op: 'add', path: ['byId', 'b'], value: { name: 'Loaded b' } },
    ]);
  });

  it('defaults the filename when no `path` callback is supplied', async () => {
    interface S {
      byId: Record<string, string>;
    }
    const def = defineService({
      id: 'test/loader-default-path',
      state: { byId: {} } as S,
      queries: { getOne: (s: S, id: string) => s.byId[id] },
      commands: {
        load: async (id: string, ctx: ServiceCtx<S>) => {
          ctx.self.setState((d) => {
            d.byId[id] = `name-${id}`;
          });
        },
      },
      load: {
        getOne: defineLoader<S, string>(
          async (id, ctx) => {
            await ctx.self.commands.load(id);
          },
          ['x', 'y']
        ),
      },
    });

    const artifacts = await buildServiceArtifacts(def);
    expect(artifacts.has('getOne-x.json')).toBe(true);
    expect(artifacts.has('getOne-y.json')).toBe(true);
  });

  it('resolves enumerateInputs when given as an async function', async () => {
    interface S {
      byId: Record<string, true>;
    }
    const def = defineService({
      id: 'test/loader-enumerate-fn',
      state: { byId: {} } as S,
      queries: { getOne: (s: S, id: string) => s.byId[id] },
      commands: {
        load: async (id: string, ctx: ServiceCtx<S>) => {
          ctx.self.setState((d) => {
            d.byId[id] = true;
          });
        },
      },
      load: {
        getOne: defineLoader<S, string>(
          async (id, ctx) => {
            await ctx.self.commands.load(id);
          },
          async () => ['p', 'q', 'r']
        ),
      },
    });

    const artifacts = await buildServiceArtifacts(def);
    expect(artifacts.has('getOne-p.json')).toBe(true);
    expect(artifacts.has('getOne-q.json')).toBe(true);
    expect(artifacts.has('getOne-r.json')).toBe(true);
  });

  it('load: false skips everything — no state.json, no loader files', async () => {
    const def = defineService<{ x: number }>()({
      id: 'test/loader-load-false',
      state: { x: 1 },
      queries: { get: (s) => s.x },
      commands: {},
      load: false,
    });

    const artifacts = await buildServiceArtifacts(def);
    expect(artifacts.size).toBe(0);
  });
});

// -------------------- runtime fetch-first loader branching (phase 2) --------------------

describe('runtime loader branching (load)', () => {
  it('fires loader body when no transport is installed', async () => {
    interface S {
      byId: Record<string, string>;
    }
    const realLoadCalls: string[] = [];
    const def = defineService({
      id: 'test/loader-live',
      state: { byId: {} } as S,
      queries: { getOne: (s: S, id: string) => s.byId[id] },
      commands: {
        load: async (id: string, ctx: ServiceCtx<S>) => {
          realLoadCalls.push(id);
          ctx.self.setState((d) => {
            d.byId[id] = `live-${id}`;
          });
        },
      },
      load: {
        getOne: defineLoader<S, string>(
          async (id, ctx) => {
            await ctx.self.commands.load(id);
          },
          ['a']
        ),
      },
    });

    const store = registerService(def);
    const listener = vi.fn();
    store.queries.getOne.subscribe('a', listener);

    await new Promise((r) => setTimeout(r, 0));

    expect(realLoadCalls).toEqual(['a']);
    expect(listener).toHaveBeenCalledWith('live-a');
  });

  it('fetches and applies patches when transport is installed; loader body is NOT called', async () => {
    interface S {
      byId: Record<string, string>;
    }
    const realLoadCalls: string[] = [];
    const def = defineService({
      id: 'test/loader-static',
      state: { byId: {} } as S,
      queries: { getOne: (s: S, id: string) => s.byId[id] },
      commands: {
        load: async (id: string, ctx: ServiceCtx<S>) => {
          realLoadCalls.push(id);
          ctx.self.setState((d) => {
            d.byId[id] = `live-${id}`;
          });
        },
      },
      load: {
        getOne: defineLoader<S, string>(
          async (id, ctx) => {
            await ctx.self.commands.load(id);
          },
          ['a'],
          { path: (_c, id) => `entries/${id}.json` }
        ),
      },
    });

    // Pretend the build wrote out the patches for input 'a'.
    const transport = mockTransport();
    transport.files.set(`${def.id}/entries/a.json`, [
      { op: 'add', path: ['byId', 'a'], value: 'from-static' },
    ]);
    setStaticTransport(transport);

    const store = registerService(def);
    const listener = vi.fn();
    store.queries.getOne.subscribe('a', listener);

    await new Promise((r) => setTimeout(r, 0));

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
      queries: { getOne: (s: S, id: string) => s.byId[id] },
      commands: {
        load: async (id: string, ctx: ServiceCtx<S>) => {
          realLoadCalls.push(id);
          ctx.self.setState((d) => {
            d.byId[id] = `live-${id}`;
          });
        },
      },
      load: {
        getOne: defineLoader<S, string>(
          async (id, ctx) => {
            await ctx.self.commands.load(id);
          },
          ['a']
        ),
      },
    });

    // Transport installed but has no entry for this loader — fetch returns null.
    setStaticTransport(mockTransport());

    const store = registerService(def);
    store.queries.getOne.subscribe('a', vi.fn());

    await new Promise((r) => setTimeout(r, 0));

    expect(realLoadCalls).toEqual(['a']); // body did run as fallback
    expect(store.queries.getOne('a')).toBe('live-a');
  });

  it('per-loader files are lazy: no fetch until a query is subscribed/called', async () => {
    interface S {
      byId: Record<string, string>;
    }
    const def = defineService({
      id: 'test/loader-lazy',
      state: { byId: {} } as S,
      queries: { getOne: (s: S, id: string) => s.byId[id] },
      commands: {
        load: async (id: string, ctx: ServiceCtx<S>) => {
          ctx.self.setState((d) => {
            d.byId[id] = `live-${id}`;
          });
        },
      },
      load: {
        getOne: defineLoader<S, string>(
          async (id, ctx) => {
            await ctx.self.commands.load(id);
          },
          ['a', 'b', 'c'],
          { path: (_c, id) => `entries/${id}.json` }
        ),
      },
    });

    // Track every fetch call by (serviceId, filename).
    const fetched: string[] = [];
    const files = new Map<string, unknown>();
    files.set(`${def.id}/state.json`, { byId: {} });
    files.set(`${def.id}/entries/a.json`, [{ op: 'add', path: ['byId', 'a'], value: 'static-a' }]);
    files.set(`${def.id}/entries/b.json`, [{ op: 'add', path: ['byId', 'b'], value: 'static-b' }]);
    files.set(`${def.id}/entries/c.json`, [{ op: 'add', path: ['byId', 'c'], value: 'static-c' }]);
    setStaticTransport({
      fetch: async (serviceId, filename) => {
        const key = `${serviceId}/${filename}`;
        fetched.push(filename);
        return files.has(key) ? files.get(key)! : null;
      },
    });

    const store = registerService(def);
    await store.ready;

    // After registration, only state.json should have been fetched. The three per-loader
    // files for 'a', 'b', 'c' must NOT have been touched yet.
    expect(fetched).toEqual(['state.json']);

    // Subscribing to 'a' triggers exactly one new fetch — for entries/a.json only.
    store.queries.getOne.subscribe('a', vi.fn());
    await new Promise((r) => setTimeout(r, 0));
    expect(fetched).toEqual(['state.json', 'entries/a.json']);

    // Subscribing to 'b' triggers entries/b.json. Still nothing for 'c'.
    store.queries.getOne.subscribe('b', vi.fn());
    await new Promise((r) => setTimeout(r, 0));
    expect(fetched).toEqual(['state.json', 'entries/a.json', 'entries/b.json']);

    // A second subscription for 'a' does NOT re-fetch — the fired-input tracking suppresses it.
    store.queries.getOne.subscribe('a', vi.fn());
    await new Promise((r) => setTimeout(r, 0));
    expect(fetched).toEqual(['state.json', 'entries/a.json', 'entries/b.json']);
  });

  it('build → reload via transport → query returns the built value (loader round trip)', async () => {
    interface S {
      byId: Record<string, { name: string }>;
    }
    const realLoadCalls: string[] = [];
    const def = defineService({
      id: 'test/loader-roundtrip',
      state: { byId: {} } as S,
      queries: { getOne: (s: S, id: string) => s.byId[id] },
      commands: {
        load: async (id: string, ctx: ServiceCtx<S>) => {
          realLoadCalls.push(id);
          ctx.self.setState((d) => {
            d.byId[id] = { name: `built-${id}` };
          });
        },
      },
      load: {
        getOne: defineLoader<S, string>(
          async (id, ctx) => {
            await ctx.self.commands.load(id);
          },
          ['Button', 'Tabs'],
          { path: (_c, id) => `docgen-${id}.json` }
        ),
      },
    });

    // 1. Build emits the per-loader files (body runs once per input in sandbox).
    const artifacts = await buildServiceArtifacts(def);
    expect(realLoadCalls).toEqual(['Button', 'Tabs']);
    expect(artifacts.has('docgen-Button.json')).toBe(true);
    expect(artifacts.has('docgen-Tabs.json')).toBe(true);

    // 2. Install transport with the built artifacts, register fresh.
    realLoadCalls.length = 0;
    installTransportFromArtifacts(def.id, artifacts);
    const reloaded = registerService(def);
    await reloaded.ready;

    // 3. Subscribing to a query triggers a fetch (not the body), and the data lands in state.
    const listener = vi.fn();
    reloaded.queries.getOne.subscribe('Button', listener);
    await new Promise((r) => setTimeout(r, 0));

    expect(realLoadCalls).toEqual([]); // never ran live
    expect(reloaded.queries.getOne('Button')).toEqual({ name: 'built-Button' });
    expect(listener).toHaveBeenCalledWith({ name: 'built-Button' });
  });
});

// -------------------- round trip --------------------

describe('build → load round trip', () => {
  it('mutate → build → fresh register with installed transport → state matches', async () => {
    interface S {
      byId: Record<string, { name: string }>;
      cursor: number;
    }
    const def = defineService({
      id: 'test/roundtrip',
      state: { byId: {}, cursor: 0 } as S,
      queries: {
        get: (s: S, id: string) => s.byId[id],
        cursor: (s: S) => s.cursor,
      },
      commands: {
        add: (input: { id: string; name: string }, ctx: ServiceCtx<S>) =>
          ctx.self.setState((d) => {
            d.byId[input.id] = { name: input.name };
            d.cursor += 1;
          }),
      },
    });

    // 1. Build: mutate a fresh runtime, snapshot.
    const buildRuntime = new ServiceRuntime(def);
    await buildRuntime.commands.add({ id: 'a', name: 'Alice' });
    await buildRuntime.commands.add({ id: 'b', name: 'Bob' });
    const artifacts = buildServiceArtifactsFromRuntime(buildRuntime);

    expect(artifacts.get(STATE_ARTIFACT_NAME)).toEqual({
      byId: { a: { name: 'Alice' }, b: { name: 'Bob' } },
      cursor: 2,
    });

    // 2. Install a transport carrying those artifacts, then register fresh.
    installTransportFromArtifacts(def.id, artifacts);
    const reloaded = registerService(def);
    await reloaded.ready;

    // 3. Verify state matches what was mutated at build time.
    expect(reloaded.queries.get('a')).toEqual({ name: 'Alice' });
    expect(reloaded.queries.get('b')).toEqual({ name: 'Bob' });
    expect(reloaded.queries.cursor()).toBe(2);
  });
});
