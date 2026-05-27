import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { defineService } from './define-service.ts';
import { __resetServiceRegistry, registerService } from './register-service.ts';
import { ServiceRuntime, deepMerge } from './service-runtime.ts';
import type { ServiceCtx } from './types.ts';

/** Wait a tick — enough for fire-and-forget preload promises to settle. */
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
          handler: (s: { value: string }) => s.value,
        },
      },
      commands: {},
    });
    const service = registerService(def);

    expect(service.queries.get()).toBe('hi');
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
          handler: (s: S, id: string) => s.byId[id],
        },
      },
      commands: {},
    });
    const service = registerService(def);

    expect(service.queries.getById('a')).toBe(1);
    expect(service.queries.getById('b')).toBe(2);
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
        getA: { input: z.void(), output: z.number(), handler: (s: S) => s.a },
        getB: { input: z.void(), output: z.number(), handler: (s: S) => s.b },
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
    const service = registerService(def);

    const aListener = vi.fn();
    const bListener = vi.fn();
    service.queries.getA.subscribe(aListener);
    service.queries.getB.subscribe(bListener);

    await service.commands.bumpA();
    expect(aListener).toHaveBeenCalledTimes(1);
    expect(aListener).toHaveBeenLastCalledWith(1);
    expect(bListener).not.toHaveBeenCalled();

    await service.commands.bumpB();
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
          handler: (s: S, id: string) => s.byId[id]?.name,
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
    const service = registerService(def);

    const listener = vi.fn();
    service.queries.getName.subscribe('a', listener);

    await service.commands.rewriteAToSameValue();
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
      queries: { get: { input: z.void(), output: z.number(), handler: (s: S) => s.count } },
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
    const service = registerService(def);

    await service.commands.increment();
    expect(service.queries.get()).toBe(1);
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
          handler: (s: S, id: string) => s.byId[id],
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
    const service = registerService(def);

    await service.commands.setName({ id: 'a', name: 'Alice' });
    expect(service.queries.get('a')).toBe('Alice');
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
          handler: (s: S, id: string) => s.byId[id],
        },
      },
      commands: {
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

    const service = registerService(def, {
      commands: {
        load: handlerSpy,
      },
    });

    await service.commands.load({ id: 'a', name: 'Alice' });

    expect(handlerSpy).toHaveBeenCalledTimes(1);
    expect(service.queries.get('a')).toBe('Alice');
  });

  it('registers an abstract command without a handler (call fails until handler arrives)', async () => {
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

    const service = registerService(def);

    await expect(service.commands.load({ id: 'x' })).rejects.toThrow(/no handler in this runtime/);
  });

  it('throws when registration tries to override a concrete command', () => {
    interface S {
      n: number;
    }
    const def = defineService()({
      id: 'test/override-concrete-rejected',
      state: { n: 0 } as S,
      queries: { get: { input: z.void(), output: z.number(), handler: (s: S) => s.n } },
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
      queries: { isReady: { input: z.void(), output: z.boolean(), handler: (s: S) => s.ready } },
      commands: {
        boot: { input: z.void(), output: z.void() },
      },
    });

    const service = registerService(def, {
      commands: {
        boot: (ctx) =>
          (ctx as ServiceCtx<S>).self.setState((d) => {
            d.ready = true;
          }),
      },
    });

    expect(service.queries.isReady()).toBe(false);
    await service.commands.boot();
    expect(service.queries.isReady()).toBe(true);
  });
});

// -------------------- encapsulation --------------------

describe('encapsulation', () => {
  it('public ServiceStore exposes only id/definition/queries/commands', () => {
    const def = defineService()({
      id: 'test/encapsulation',
      state: { secret: 42 },
      queries: {
        get: {
          input: z.void(),
          output: z.number(),
          handler: (s: { secret: number }) => s.secret,
        },
      },
      commands: {},
    });
    const service = registerService(def);

    // The runtime class has getState/setState/subscribe for infrastructure use; the public
    // store omits them. Object.keys reflects the frozen public view.
    expect(Object.keys(service).sort()).toEqual(['commands', 'definition', 'id', 'queries']);
    expect(service.queries.get()).toBe(42);
  });
});

// -------------------- preloads --------------------

describe('preloads', () => {
  it('a query subscription fires the paired preload on first miss', async () => {
    interface S {
      byId: Record<string, string>;
    }
    const generate = vi.fn(async (id: string) => `name-${id}`);

    const def = defineService()({
      id: 'test/preload-fires',
      state: { byId: {} } as S,
      queries: {
        getName: {
          input: z.string(),
          output: z.string().optional(),
          handler: (s: S, id: string) => s.byId[id],
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
    const service = registerService(def);

    const listener = vi.fn();
    service.queries.getName.subscribe('a', listener);

    await tick();

    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledWith('a');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith('name-a');
  });

  it('concurrent subscriptions for the same input dedupe to one preload run', async () => {
    interface S {
      byId: Record<string, string>;
    }
    const generate = vi.fn(async (id: string) => {
      await new Promise<void>((r) => setTimeout(r, 5));
      return `name-${id}`;
    });

    const def = defineService()({
      id: 'test/preload-dedupe',
      state: { byId: {} } as S,
      queries: {
        getName: {
          input: z.string(),
          output: z.string().optional(),
          handler: (s: S, id: string) => s.byId[id],
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
    const service = registerService(def);

    service.queries.getName.subscribe('a', vi.fn());
    service.queries.getName.subscribe('a', vi.fn());
    service.queries.getName.subscribe('a', vi.fn());

    await new Promise<void>((r) => setTimeout(r, 20));

    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('preload fires once per distinct input', async () => {
    interface S {
      byId: Record<string, string>;
    }
    const generate = vi.fn(async (id: string) => `name-${id}`);

    const def = defineService()({
      id: 'test/preload-per-input',
      state: { byId: {} } as S,
      queries: {
        getName: {
          input: z.string(),
          output: z.string().optional(),
          handler: (s: S, id: string) => s.byId[id],
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
    const service = registerService(def);

    service.queries.getName.subscribe('a', vi.fn());
    service.queries.getName.subscribe('b', vi.fn());

    await tick();

    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls.map((c) => c[0]).sort()).toEqual(['a', 'b']);

    service.queries.getName.subscribe('a', vi.fn());
    await tick();
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('callable-query read (without subscribe) also fires the paired preload', async () => {
    interface S {
      value: string;
    }
    const generate = vi.fn(async () => 'loaded');

    const def = defineService()({
      id: 'test/preload-on-call',
      state: { value: '' } as S,
      queries: {
        get: {
          input: z.void(),
          output: z.string(),
          handler: (s: S) => s.value,
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
    const service = registerService(def);

    // First read returns un-loaded value but kicks the preload off.
    expect(service.queries.get()).toBe('');
    await tick();
    expect(generate).toHaveBeenCalledTimes(1);
    expect(service.queries.get()).toBe('loaded');
  });

  it('command without a paired preload behaves as a pure local mutation', async () => {
    interface S {
      x: number;
    }
    const def = defineService()({
      id: 'test/preload-absent',
      state: { x: 0 } as S,
      queries: { get: { input: z.void(), output: z.number(), handler: (s: S) => s.x } },
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
    const service = registerService(def);

    const listener = vi.fn();
    service.queries.get.subscribe(listener);

    await service.commands.bump();
    await service.commands.bump();

    expect(service.queries.get()).toBe(2);
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
        get: { input: z.void(), output: z.number(), handler: (s: { v: number }) => s.v },
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

// -------------------- schema validation --------------------

describe('schema validation', () => {
  it('throws ServiceValidationError on bad command input', async () => {
    const def = defineService()({
      id: 'test/validate-cmd-in',
      state: { n: 0 },
      queries: {
        get: { input: z.void(), output: z.number(), handler: (s: { n: number }) => s.n },
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
    const service = registerService(def);

    await expect(service.commands.set('not-a-number' as unknown as number)).rejects.toThrow(
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
          handler: (s: { byId: Record<string, string> }, id: string) => s.byId[id],
        },
      },
      commands: {},
    });
    const service = registerService(def);

    expect(() => service.queries.getById(42 as unknown as string)).toThrow(
      /Invalid input for query/
    );
  });

  it('throws ServiceValidationError on bad query output (catches schema regressions)', () => {
    // Selector returns a string when the schema demands a number — schema wins.
    const def = defineService()({
      id: 'test/validate-q-out',
      state: { v: 'oops' as unknown as number },
      queries: {
        get: { input: z.void(), output: z.number(), handler: (s: { v: number }) => s.v },
      },
      commands: {},
    });
    const service = registerService(def);

    expect(() => service.queries.get()).toThrow(/Invalid output for query/);
  });
});

// -------------------- defensive fixes (PR #34912 review) --------------------

describe('runtime defensive guarantees', () => {
  // Fix #1 — `structuredClone(definition.state)` in the constructor so post-hoc mutation
  // of the definition object can't leak into runtime state.
  it('isolates runtime state from later mutation of definition.state', () => {
    interface S {
      byId: Record<string, { name: string }>;
    }
    const initial: S = { byId: { a: { name: 'alpha' } } };
    const def = defineService<S>()({
      id: 'test/state-isolation',
      state: initial,
      queries: {
        getAll: { input: z.void(), output: z.any(), handler: (s: S) => s.byId },
      },
      commands: {},
    });
    const service = registerService(def);

    // External mutation of the source object after the runtime was constructed.
    initial.byId.a.name = 'MUTATED';
    initial.byId.b = { name: 'leaked' };

    expect(service.queries.getAll()).toEqual({ a: { name: 'alpha' } });
  });

  // Fix #2/8 — `_maybeFirePreload` returns the raw promise so `firePreload` callers (build)
  // observe rejections. The fire-and-forget call sites (query call / subscribe) attach
  // their own `.catch(rethrowAsync)`.
  it('firePreload rejects when the preload throws (build pipeline can see failures)', async () => {
    const def = defineService<{ x: number }>()({
      id: 'test/preload-rejects',
      state: { x: 0 },
      queries: {
        get: {
          input: z.void(),
          output: z.number(),
          handler: (s: { x: number }) => s.x,
          preload: async () => {
            throw new Error('boom');
          },
        },
      },
      commands: {},
    });

    const runtime = new ServiceRuntime(def);
    await expect(runtime.firePreload('get', undefined)).rejects.toThrow(/boom/);
  });

  it('surfaces fire-and-forget preload failures via rethrowAsync (no unhandled rejection)', async () => {
    const def = defineService<{ x: number }>()({
      id: 'test/preload-unhandled',
      state: { x: 0 },
      queries: {
        get: {
          input: z.void(),
          output: z.number(),
          handler: (s: { x: number }) => s.x,
          preload: async () => {
            throw new Error('boom-fire-and-forget');
          },
        },
      },
      commands: {},
    });

    // Contract: the fire-and-forget call site uses `.catch(rethrowAsync)`. That means
    //   (a) the promise *is* handled — no `unhandledRejection` event fires, and
    //   (b) the error re-throws on the microtask queue, surfacing as an `uncaughtException`
    //       in Node (or a window error in the browser), so devtools still sees it.
    // We assert both halves so a future refactor of `rethrowAsync` that silently swallows
    // the error fails this test.

    const unhandledRejections: unknown[] = [];
    const uncaughtExceptions: unknown[] = [];
    const onRejection = (reason: unknown) => {
      unhandledRejections.push(reason);
    };
    const onException = (err: unknown) => {
      uncaughtExceptions.push(err);
    };

    process.on('unhandledRejection', onRejection);
    process.prependListener('uncaughtException', onException);
    // Replace any pre-existing uncaughtException listeners (e.g. vitest's own) so the
    // microtask re-throw doesn't actually fail the test run.
    const originalListeners = process.listeners('uncaughtException').slice();
    for (const l of originalListeners) {
      if (l !== onException) process.off('uncaughtException', l);
    }

    try {
      const service = registerService(def);
      service.queries.get();
      await new Promise((r) => setTimeout(r, 10));
    } finally {
      process.off('unhandledRejection', onRejection);
      process.off('uncaughtException', onException);
      for (const l of originalListeners) {
        if (l !== onException) process.on('uncaughtException', l);
      }
    }

    expect(unhandledRejections).toEqual([]);
    expect(uncaughtExceptions).toHaveLength(1);
    expect((uncaughtExceptions[0] as Error).message).toBe('boom-fire-and-forget');
  });
});

// -------------------- prototype-pollution hardening (Fix #10) --------------------

describe('deepMerge prototype-pollution guard', () => {
  it('skips __proto__ keys so JSON-parsed sources cannot pollute Object.prototype', () => {
    const target: Record<string, unknown> = {};
    const poisoned = JSON.parse('{"__proto__":{"polluted":true},"safe":1}');

    deepMerge(target, poisoned);

    expect(target).toEqual({ safe: 1 });
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('skips constructor and prototype keys', () => {
    const target: Record<string, unknown> = {};
    deepMerge(target, {
      constructor: { evil: true } as unknown,
      prototype: { evil: true } as unknown,
      legit: 1,
    });
    expect(target).toEqual({ legit: 1 });
  });
});
