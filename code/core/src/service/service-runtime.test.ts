import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { defineService } from './define-service.ts';
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
    const def = defineService()({
      id: 'test/q-noinput',
      state: { value: 'hi' },
      queries: {
        get: {
          input: z.void(),
          output: z.string(),
          select: (s: { value: string }) => s.value,
        },
      },
      commands: {},
    });
    const store = registerService(def);

    expect(store.queries.get()).toBe('hi');
  });

  it('runs an input-keyed query', () => {
    interface S {
      byId: Record<string, number>;
    }
    const def = defineService()({
      id: 'test/q-input',
      state: { byId: { a: 1, b: 2 } } as S,
      queries: {
        getById: {
          input: z.string(),
          output: z.number().optional(),
          select: (s: S, id: string) => s.byId[id],
        },
      },
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
    const def = defineService()({
      id: 'test/q-subscribe',
      state: { a: 0, b: 0 } as S,
      queries: {
        getA: { input: z.void(), output: z.number(), select: (s: S) => s.a },
        getB: { input: z.void(), output: z.number(), select: (s: S) => s.b },
      },
      commands: {
        bumpA: {
          input: z.void(),
          output: z.void(),
          handler: (ctx: ServiceCtx<S>) =>
            ctx.self.setState((d) => {
              d.a += 1;
            }),
        },
        bumpB: {
          input: z.void(),
          output: z.void(),
          handler: (ctx: ServiceCtx<S>) =>
            ctx.self.setState((d) => {
              d.b += 1;
            }),
        },
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
    const def = defineService()({
      id: 'test/q-dedupe',
      state: { byId: { a: { name: 'A' } } } as S,
      queries: {
        getName: {
          input: z.string(),
          output: z.string().optional(),
          select: (s: S, id: string) => s.byId[id]?.name,
        },
      },
      commands: {
        rewriteAToSameValue: {
          input: z.void(),
          output: z.void(),
          handler: (ctx: ServiceCtx<S>) =>
            ctx.self.setState((d) => {
              d.byId.a = { name: 'A' };
            }),
        },
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
    const def = defineService()({
      id: 'test/cmd-noinput',
      state: { count: 0 } as S,
      queries: { get: { input: z.void(), output: z.number(), select: (s: S) => s.count } },
      commands: {
        increment: {
          input: z.void(),
          output: z.void(),
          handler: (ctx: ServiceCtx<S>) =>
            ctx.self.setState((d) => {
              d.count += 1;
            }),
        },
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
    const def = defineService()({
      id: 'test/cmd-async',
      state: { byId: {} } as S,
      queries: {
        get: {
          input: z.string(),
          output: z.string().optional(),
          select: (s: S, id: string) => s.byId[id],
        },
      },
      commands: {
        setName: {
          input: z.object({ id: z.string(), name: z.string() }),
          output: z.void(),
          handler: async (input: { id: string; name: string }, ctx: ServiceCtx<S>) => {
            await Promise.resolve();
            ctx.self.setState((d) => {
              d.byId[input.id] = input.name;
            });
          },
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
  it('definition declares abstract command (handler missing); registration supplies handler', async () => {
    interface S {
      byId: Record<string, string>;
    }
    const def = defineService()({
      id: 'test/abstract-impl',
      state: { byId: {} } as S,
      queries: {
        get: {
          input: z.string(),
          output: z.string().optional(),
          select: (s: S, id: string) => s.byId[id],
        },
      },
      commands: {
        // No `handler` — abstract.
        load: {
          input: z.object({ id: z.string(), name: z.string() }),
          output: z.void(),
        },
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

  it('registers an abstract command without a handler (call defers/fails until handler arrives)', async () => {
    // A service may be registered in multiple runtimes; only some need to handle a given
    // abstract command. Registration succeeds with no override; calling the command throws
    // until a handler is available (today via this registration, later via a peer runtime).
    const def = defineService()({
      id: 'test/abstract-no-handler-registers',
      state: {},
      queries: {},
      commands: {
        load: {
          input: z.object({ id: z.string() }),
          output: z.void(),
        },
      },
    });

    const store = registerService(def);

    await expect(store.commands.load({ id: 'x' })).rejects.toThrow(/no handler in this runtime/);
  });

  it('throws when registration tries to override a concrete command', () => {
    interface S {
      n: number;
    }
    const def = defineService()({
      id: 'test/override-concrete-rejected',
      state: { n: 0 } as S,
      queries: { get: { input: z.void(), output: z.number(), select: (s: S) => s.n } },
      commands: {
        bump: {
          input: z.void(),
          output: z.void(),
          handler: (ctx: ServiceCtx<S>) =>
            ctx.self.setState((d) => {
              d.n += 1;
            }),
        },
      },
    });

    expect(() =>
      registerService(def, {
        // Bypass the type system (concrete overrides are excluded from `CommandOverrides`)
        // to assert the runtime guard fires.
        commands: {
          bump: (ctx: ServiceCtx<S>) =>
            ctx.self.setState((d) => {
              d.n += 100;
            }),
        } as never,
      })
    ).toThrow(/concrete.*cannot be overridden at registration/);
  });

  it('abstract command with no input arg', async () => {
    interface S {
      ready: boolean;
    }
    const def = defineService()({
      id: 'test/abstract-noinput',
      state: { ready: false } as S,
      queries: { isReady: { input: z.void(), output: z.boolean(), select: (s: S) => s.ready } },
      commands: {
        boot: { input: z.void(), output: z.void() },
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

    const def = defineService()({
      id: 'test/loader-fires',
      state: { byId: {} } as S,
      queries: {
        getName: {
          input: z.string(),
          output: z.string().optional(),
          select: (s: S, id: string) => s.byId[id],
          preload: async (id: string, ctx: ServiceCtx<S>) => {
            await ctx.self.commands.load(id);
          },
          inputs: ['a', 'b'],
        },
      },
      commands: {
        load: {
          input: z.string(),
          output: z.void(),
          handler: async (id: string, ctx: ServiceCtx<S>) => {
            const name = await generate(id);
            ctx.self.setState((d) => {
              d.byId[id] = name;
            });
          },
        },
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

    const def = defineService()({
      id: 'test/loader-dedupe',
      state: { byId: {} } as S,
      queries: {
        getName: {
          input: z.string(),
          output: z.string().optional(),
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
            const name = await generate(id);
            ctx.self.setState((d) => {
              d.byId[id] = name;
            });
          },
        },
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

    const def = defineService()({
      id: 'test/loader-per-input',
      state: { byId: {} } as S,
      queries: {
        getName: {
          input: z.string(),
          output: z.string().optional(),
          select: (s: S, id: string) => s.byId[id],
          preload: async (id: string, ctx: ServiceCtx<S>) => {
            await ctx.self.commands.load(id);
          },
          inputs: ['a', 'b'],
        },
      },
      commands: {
        load: {
          input: z.string(),
          output: z.void(),
          handler: async (id: string, ctx: ServiceCtx<S>) => {
            const name = await generate(id);
            ctx.self.setState((d) => {
              d.byId[id] = name;
            });
          },
        },
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

    const def = defineService()({
      id: 'test/loader-on-call',
      state: { value: '' } as S,
      queries: {
        get: {
          input: z.void(),
          output: z.string(),
          select: (s: S) => s.value,
          preload: async (ctx: ServiceCtx<S>) => {
            await ctx.self.commands.load();
          },
        },
      },
      commands: {
        load: {
          input: z.void(),
          output: z.void(),
          handler: async (ctx: ServiceCtx<S>) => {
            const v = await generate();
            ctx.self.setState((d) => {
              d.value = v;
            });
          },
        },
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
    const def = defineService()({
      id: 'test/loader-absent',
      state: { x: 0 } as S,
      queries: { get: { input: z.void(), output: z.number(), select: (s: S) => s.x } },
      commands: {
        bump: {
          input: z.void(),
          output: z.void(),
          handler: (ctx: ServiceCtx<S>) =>
            ctx.self.setState((d) => {
              d.x += 1;
            }),
        },
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
    const def = defineService()({
      id: 'test/registry-idem',
      state: { v: 1 },
      queries: {
        get: { input: z.void(), output: z.number(), select: (s: { v: number }) => s.v },
      },
      commands: {},
    });
    const a = registerService(def);
    const b = registerService(def);
    expect(a).toBe(b);
  });

  it('throws if a different definition is registered against the same id', () => {
    const a = defineService()({
      id: 'test/registry-conflict',
      state: {},
      queries: {},
      commands: {},
    });
    const b = defineService()({
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
    const def = defineService()({
      id: 'test/encapsulation',
      state: { secret: 42 },
      queries: {
        get: {
          input: z.void(),
          output: z.number(),
          select: (s: { secret: number }) => s.secret,
        },
      },
      commands: {},
    });
    const store = registerService(def);

    // Type-level encapsulation is enforced by tsc; runtime-level: these properties should not exist
    // on the public store object.
    expect('getState' in store).toBe(false);
    expect('setState' in store).toBe(false);
    expect('subscribe' in store).toBe(false);

    // The only way in is queries / commands.
    expect(Object.keys(store).sort()).toEqual(['commands', 'definition', 'id', 'queries']);
    expect(store.queries.get()).toBe(42);
  });
});

// -------------------- schema validation --------------------

describe('schema validation', () => {
  it('throws ServiceValidationError on bad command input', async () => {
    const def = defineService()({
      id: 'test/validate-cmd-in',
      state: { n: 0 },
      queries: {
        get: { input: z.void(), output: z.number(), select: (s: { n: number }) => s.n },
      },
      commands: {
        set: {
          input: z.number(),
          output: z.void(),
          handler: (n: number, ctx: ServiceCtx<{ n: number }>) =>
            ctx.self.setState((d) => {
              d.n = n;
            }),
        },
      },
    });
    const store = registerService(def);

    await expect(store.commands.set('not-a-number' as unknown as number)).rejects.toThrow(
      /Invalid input for command/
    );
  });

  it('throws ServiceValidationError on bad query input', () => {
    const def = defineService()({
      id: 'test/validate-q-in',
      state: { byId: { a: 'alpha' } } as { byId: Record<string, string> },
      queries: {
        getById: {
          input: z.string(),
          output: z.string().optional(),
          select: (s: { byId: Record<string, string> }, id: string) => s.byId[id],
        },
      },
      commands: {},
    });
    const store = registerService(def);

    expect(() => store.queries.getById(42 as unknown as string)).toThrow(/Invalid input for query/);
  });

  it('throws ServiceValidationError on bad query output (catches schema regressions)', () => {
    // Selector returns a string when the schema demands a number — schema wins.
    const def = defineService()({
      id: 'test/validate-q-out',
      state: { v: 'oops' as unknown as number },
      queries: {
        get: { input: z.void(), output: z.number(), select: (s: { v: number }) => s.v },
      },
      commands: {},
    });
    const store = registerService(def);

    expect(() => store.queries.get()).toThrow(/Invalid output for query/);
  });
});
