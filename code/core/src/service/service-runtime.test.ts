import { afterEach, describe, expect, it, vi } from 'vitest';

import { defineCommand, defineLoader, defineService } from './define-service.ts';
import { __resetServiceRegistry, registerService } from './register-service.ts';
import type { ServiceCtx } from './types.ts';

/** Wait a tick — enough for fire-and-forget loader promises to settle. */
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  __resetServiceRegistry();
});

// All tests below interact with services through the *official* surface:
//   - queries to read
//   - commands to mutate
//   - query.subscribe to react
// Nothing touches the runtime's state directly. The whole point is to verify that this
// surface is sufficient to express the use cases we care about.

// -------------------- queries --------------------

describe('queries', () => {
  it('runs a no-input query', () => {
    const def = defineService({
      id: 'test/q-noinput',
      state: { value: 'hi' },
      queries: { get: (s: { value: string }) => s.value },
      commands: {},
    });
    const store = registerService(def);

    expect(store.queries.get()).toBe('hi');
  });

  it('runs an input-keyed query', () => {
    interface S {
      byId: Record<string, number>;
    }
    const def = defineService({
      id: 'test/q-input',
      state: { byId: { a: 1, b: 2 } } as S,
      queries: { getById: (s: S, id: string) => s.byId[id] },
      commands: {},
    });
    const store = registerService(def);

    expect(store.queries.getById('a')).toBe(1);
    expect(store.queries.getById('b')).toBe(2);
  });

  it("subscribers fire only when a query's result actually changes", async () => {
    interface S {
      a: number;
      b: number;
    }
    const def = defineService({
      id: 'test/q-subscribe',
      state: { a: 0, b: 0 } as S,
      queries: {
        getA: (s: S) => s.a,
        getB: (s: S) => s.b,
      },
      commands: {
        bumpA: (ctx: ServiceCtx<S>) =>
          ctx.self.setState((d) => {
            d.a += 1;
          }),
        bumpB: (ctx: ServiceCtx<S>) =>
          ctx.self.setState((d) => {
            d.b += 1;
          }),
      },
    });
    const store = registerService(def);

    const aListener = vi.fn();
    const bListener = vi.fn();
    store.queries.getA.subscribe(aListener);
    store.queries.getB.subscribe(bListener);

    await store.commands.bumpA();
    expect(aListener).toHaveBeenCalledTimes(1);
    expect(aListener).toHaveBeenLastCalledWith(1);
    expect(bListener).not.toHaveBeenCalled();

    await store.commands.bumpB();
    expect(aListener).toHaveBeenCalledTimes(1); // still 1 — A didn't change
    expect(bListener).toHaveBeenCalledTimes(1);
  });

  it('subscriber-side de-duplication: structurally-equal result does not re-notify', async () => {
    interface S {
      byId: Record<string, { name: string }>;
    }
    const def = defineService({
      id: 'test/q-dedupe',
      state: { byId: { a: { name: 'A' } } } as S,
      queries: {
        getName: (s: S, id: string) => s.byId[id]?.name,
      },
      commands: {
        rewriteAToSameValue: (ctx: ServiceCtx<S>) =>
          ctx.self.setState((d) => {
            d.byId.a = { name: 'A' };
          }),
      },
    });
    const store = registerService(def);

    const listener = vi.fn();
    store.queries.getName.subscribe('a', listener);

    await store.commands.rewriteAToSameValue();
    expect(listener).not.toHaveBeenCalled();
  });
});

// -------------------- commands --------------------

describe('commands', () => {
  it('runs a no-input command', async () => {
    interface S {
      count: number;
    }
    const def = defineService({
      id: 'test/cmd-noinput',
      state: { count: 0 } as S,
      queries: { get: (s: S) => s.count },
      commands: {
        increment: (ctx: ServiceCtx<S>) =>
          ctx.self.setState((d) => {
            d.count += 1;
          }),
      },
    });
    const store = registerService(def);

    await store.commands.increment();
    expect(store.queries.get()).toBe(1);
  });

  it('runs an input-keyed async command', async () => {
    interface S {
      byId: Record<string, string>;
    }
    const def = defineService({
      id: 'test/cmd-async',
      state: { byId: {} } as S,
      queries: { get: (s: S, id: string) => s.byId[id] },
      commands: {
        setName: async (input: { id: string; name: string }, ctx: ServiceCtx<S>) => {
          await Promise.resolve();
          ctx.self.setState((d) => {
            d.byId[input.id] = input.name;
          });
        },
      },
    });
    const store = registerService(def);

    await store.commands.setName({ id: 'a', name: 'Alice' });
    expect(store.queries.get('a')).toBe('Alice');
  });
});

// -------------------- abstract commands --------------------

describe('abstract commands', () => {
  it('definition declares abstract command; registration supplies handler', async () => {
    interface S {
      byId: Record<string, string>;
    }
    const def = defineService({
      id: 'test/abstract-impl',
      state: { byId: {} } as S,
      queries: { get: (s: S, id: string) => s.byId[id] },
      commands: {
        load: defineCommand<{ id: string; name: string }>(),
      },
    });

    const handlerSpy = vi.fn(async (input: { id: string; name: string }, ctx: ServiceCtx<S>) => {
      ctx.self.setState((d) => {
        d.byId[input.id] = input.name;
      });
    });

    const store = registerService(def, {
      commands: {
        load: handlerSpy,
      },
    });

    await store.commands.load({ id: 'a', name: 'Alice' });

    expect(handlerSpy).toHaveBeenCalledTimes(1);
    expect(store.queries.get('a')).toBe('Alice');
  });

  it('throws at registration when an abstract command has no implementation', () => {
    const def = defineService({
      id: 'test/abstract-missing',
      state: {},
      queries: {},
      commands: {
        load: defineCommand<{ id: string }>(),
      },
    });

    expect(() => registerService(def)).toThrow(
      /abstract and has no implementation at registration/
    );
  });

  it('registration can override a concrete command (env-specific body)', async () => {
    interface S {
      n: number;
    }
    const def = defineService({
      id: 'test/override-concrete',
      state: { n: 0 } as S,
      queries: { get: (s: S) => s.n },
      commands: {
        bump: (ctx: ServiceCtx<S>) =>
          ctx.self.setState((d) => {
            d.n += 1;
          }),
      },
    });

    const store = registerService(def, {
      commands: {
        bump: (ctx) =>
          (ctx as ServiceCtx<S>).self.setState((d) => {
            d.n += 100;
          }),
      },
    });

    await store.commands.bump();
    expect(store.queries.get()).toBe(100);
  });

  it('abstract command with no input arg', async () => {
    interface S {
      ready: boolean;
    }
    const def = defineService({
      id: 'test/abstract-noinput',
      state: { ready: false } as S,
      queries: { isReady: (s: S) => s.ready },
      commands: {
        boot: defineCommand(),
      },
    });

    const store = registerService(def, {
      commands: {
        boot: (ctx) =>
          (ctx as ServiceCtx<S>).self.setState((d) => {
            d.ready = true;
          }),
      },
    });

    expect(store.queries.isReady()).toBe(false);
    await store.commands.boot();
    expect(store.queries.isReady()).toBe(true);
  });
});

// -------------------- loaders --------------------

describe('loaders', () => {
  it('a query subscription fires the paired loader on first miss', async () => {
    interface S {
      byId: Record<string, string>;
    }
    const generate = vi.fn(async (id: string) => `name-${id}`);

    const def = defineService({
      id: 'test/loader-fires',
      state: { byId: {} } as S,
      queries: { getName: (s: S, id: string) => s.byId[id] },
      commands: {
        load: async (id: string, ctx: ServiceCtx<S>) => {
          const name = await generate(id);
          ctx.self.setState((d) => {
            d.byId[id] = name;
          });
        },
      },
      load: {
        getName: defineLoader<S, string>(
          async (id, ctx) => {
            await ctx.self.commands.load(id);
          },
          ['a', 'b']
        ),
      },
    });
    const store = registerService(def);

    const listener = vi.fn();
    store.queries.getName.subscribe('a', listener);

    await tick();

    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledWith('a');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith('name-a');
  });

  it('concurrent subscriptions for the same input dedupe to one loader run', async () => {
    interface S {
      byId: Record<string, string>;
    }
    const generate = vi.fn(async (id: string) => {
      await new Promise<void>((r) => setTimeout(r, 5));
      return `name-${id}`;
    });

    const def = defineService({
      id: 'test/loader-dedupe',
      state: { byId: {} } as S,
      queries: { getName: (s: S, id: string) => s.byId[id] },
      commands: {
        load: async (id: string, ctx: ServiceCtx<S>) => {
          const name = await generate(id);
          ctx.self.setState((d) => {
            d.byId[id] = name;
          });
        },
      },
      load: {
        getName: defineLoader<S, string>(
          async (id, ctx) => {
            await ctx.self.commands.load(id);
          },
          ['a']
        ),
      },
    });
    const store = registerService(def);

    store.queries.getName.subscribe('a', vi.fn());
    store.queries.getName.subscribe('a', vi.fn());
    store.queries.getName.subscribe('a', vi.fn());

    await new Promise<void>((r) => setTimeout(r, 20));

    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('loader fires once per distinct input', async () => {
    interface S {
      byId: Record<string, string>;
    }
    const generate = vi.fn(async (id: string) => `name-${id}`);

    const def = defineService({
      id: 'test/loader-per-input',
      state: { byId: {} } as S,
      queries: { getName: (s: S, id: string) => s.byId[id] },
      commands: {
        load: async (id: string, ctx: ServiceCtx<S>) => {
          const name = await generate(id);
          ctx.self.setState((d) => {
            d.byId[id] = name;
          });
        },
      },
      load: {
        getName: defineLoader<S, string>(
          async (id, ctx) => {
            await ctx.self.commands.load(id);
          },
          ['a', 'b']
        ),
      },
    });
    const store = registerService(def);

    store.queries.getName.subscribe('a', vi.fn());
    store.queries.getName.subscribe('b', vi.fn());

    await tick();

    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls.map((c) => c[0]).sort()).toEqual(['a', 'b']);

    store.queries.getName.subscribe('a', vi.fn());
    await tick();
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('callable-query read (without subscribe) also fires the paired loader', async () => {
    interface S {
      value: string;
    }
    const generate = vi.fn(async () => 'loaded');

    const def = defineService({
      id: 'test/loader-on-call',
      state: { value: '' } as S,
      queries: { get: (s: S) => s.value },
      commands: {
        load: async (ctx: ServiceCtx<S>) => {
          const v = await generate();
          ctx.self.setState((d) => {
            d.value = v;
          });
        },
      },
      load: {
        get: defineLoader<S, void>(async (ctx) => {
          await ctx.self.commands.load();
        }, undefined),
      },
    });
    const store = registerService(def);

    // First read returns un-loaded value but kicks the loader off.
    expect(store.queries.get()).toBe('');
    await tick();
    expect(generate).toHaveBeenCalledTimes(1);
    expect(store.queries.get()).toBe('loaded');
  });

  it('command without a paired loader behaves as a pure local mutation', async () => {
    interface S {
      x: number;
    }
    const def = defineService({
      id: 'test/loader-absent',
      state: { x: 0 } as S,
      queries: { get: (s: S) => s.x },
      commands: {
        bump: (ctx: ServiceCtx<S>) =>
          ctx.self.setState((d) => {
            d.x += 1;
          }),
      },
    });
    const store = registerService(def);

    const listener = vi.fn();
    store.queries.get.subscribe(listener);

    await store.commands.bump();
    await store.commands.bump();

    expect(store.queries.get()).toBe(2);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

// -------------------- registry --------------------

describe('registerService / getService', () => {
  it('is idempotent on the same definition', () => {
    const def = defineService({
      id: 'test/registry-idem',
      state: { v: 1 },
      queries: { get: (s: { v: number }) => s.v },
      commands: {},
    });
    const a = registerService(def);
    const b = registerService(def);
    expect(a).toBe(b);
  });

  it('throws if a different definition is registered against the same id', () => {
    const a = defineService({
      id: 'test/registry-conflict',
      state: {},
      queries: {},
      commands: {},
    });
    const b = defineService({
      id: 'test/registry-conflict',
      state: {},
      queries: {},
      commands: {},
    });
    registerService(a);
    expect(() => registerService(b)).toThrow(/different service definition is already registered/);
  });
});

// -------------------- state is private --------------------

describe('encapsulation', () => {
  it('public ServiceStore does not expose state, setState, or whole-state subscribe', () => {
    const def = defineService({
      id: 'test/encapsulation',
      state: { secret: 42 },
      queries: { get: (s: { secret: number }) => s.secret },
      commands: {},
    });
    const store = registerService(def);

    // Type-level encapsulation is enforced by tsc; runtime-level: these properties should not exist
    // on the public store object.
    expect('getState' in store).toBe(false);
    expect('setState' in store).toBe(false);
    expect('subscribe' in store).toBe(false);

    // The only way in is queries / commands. `ready` is a Promise so static-mode loading
    // is observable; everything else is the service's API.
    expect(Object.keys(store).sort()).toEqual(['commands', 'definition', 'id', 'queries', 'ready']);
    expect(store.queries.get()).toBe(42);
  });
});
