// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { defineService } from './define-service.ts';
import { __resetServiceRegistry, registerService } from './register-service.ts';
import type { ServiceCtx } from './types.ts';
import { useServiceQuery } from './use-service-query.ts';

afterEach(() => {
  __resetServiceRegistry();
});

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

// -------------------- initial render --------------------

describe('useServiceQuery — initial render', () => {
  it('returns the current value on first render', () => {
    interface S {
      count: number;
    }
    const def = defineService()({
      id: 'test/hook-initial',
      state: { count: 7 } as S,
      queries: {
        get: { input: z.void(), output: z.number(), select: (s: S) => s.count },
      },
      commands: {},
    });
    const store = registerService(def);

    const { result } = renderHook(() => useServiceQuery(store, 'get'));
    expect(result.current).toBe(7);
  });

  it('returns the current value for an input-keyed query', () => {
    interface S {
      byId: Record<string, string>;
    }
    const def = defineService()({
      id: 'test/hook-initial-input',
      state: { byId: { a: 'alpha' } } as S,
      queries: {
        get: {
          input: z.string(),
          output: z.string().optional(),
          select: (s: S, id: string) => s.byId[id],
        },
      },
      commands: {},
    });
    const store = registerService(def);

    const { result } = renderHook(() => useServiceQuery(store, 'get', 'a'));
    expect(result.current).toBe('alpha');
  });
});

// -------------------- reactivity --------------------

describe('useServiceQuery — reactivity', () => {
  it('re-renders when a command changes the selected slice', async () => {
    interface S {
      count: number;
    }
    const def = defineService()({
      id: 'test/hook-rerender',
      state: { count: 0 } as S,
      queries: {
        get: { input: z.void(), output: z.number(), select: (s: S) => s.count },
      },
      commands: {
        bump: {
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

    const renderCount = vi.fn();
    const { result } = renderHook(() => {
      renderCount();
      return useServiceQuery(store, 'get');
    });

    expect(result.current).toBe(0);
    expect(renderCount).toHaveBeenCalledTimes(1);

    await act(async () => {
      await store.commands.bump();
    });

    expect(result.current).toBe(1);
    expect(renderCount).toHaveBeenCalledTimes(2);
  });

  it('does NOT re-render when an unrelated slice changes', async () => {
    interface S {
      a: number;
      b: number;
    }
    const def = defineService()({
      id: 'test/hook-no-rerender-unrelated',
      state: { a: 0, b: 0 } as S,
      queries: {
        getA: { input: z.void(), output: z.number(), select: (s: S) => s.a },
        getB: { input: z.void(), output: z.number(), select: (s: S) => s.b },
      },
      commands: {
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

    const renderCount = vi.fn();
    const { result } = renderHook(() => {
      renderCount();
      return useServiceQuery(store, 'getA');
    });

    expect(renderCount).toHaveBeenCalledTimes(1);

    await act(async () => {
      await store.commands.bumpB();
    });

    // getA's selected slice didn't change — computed memoisation kept the value identical,
    // effect never fired, React never re-rendered.
    expect(result.current).toBe(0);
    expect(renderCount).toHaveBeenCalledTimes(1);
  });

  it('does NOT re-render when setState writes a structurally-equal value', async () => {
    interface S {
      label: string;
    }
    const def = defineService()({
      id: 'test/hook-no-rerender-equal',
      state: { label: 'hello' } as S,
      queries: {
        get: { input: z.void(), output: z.string(), select: (s: S) => s.label },
      },
      commands: {
        rewrite: {
          input: z.void(),
          output: z.void(),
          handler: (ctx: ServiceCtx<S>) =>
            ctx.self.setState((d) => {
              d.label = 'hello';
            }),
        },
      },
    });
    const store = registerService(def);

    const renderCount = vi.fn();
    renderHook(() => {
      renderCount();
      return useServiceQuery(store, 'get');
    });

    expect(renderCount).toHaveBeenCalledTimes(1);

    await act(async () => {
      await store.commands.rewrite();
    });

    // Same string ('hello' === 'hello') — computed value unchanged, no re-render.
    expect(renderCount).toHaveBeenCalledTimes(1);
  });
});

// -------------------- input changes --------------------

describe('useServiceQuery — input changes', () => {
  it('returns the value for the new input when input changes between renders', async () => {
    interface S {
      byId: Record<string, string>;
    }
    const def = defineService()({
      id: 'test/hook-input-change',
      state: { byId: { a: 'alpha', b: 'beta' } } as S,
      queries: {
        get: {
          input: z.string(),
          output: z.string().optional(),
          select: (s: S, id: string) => s.byId[id],
        },
      },
      commands: {},
    });
    const store = registerService(def);

    const { result, rerender } = renderHook(({ id }) => useServiceQuery(store, 'get', id), {
      initialProps: { id: 'a' },
    });

    expect(result.current).toBe('alpha');

    rerender({ id: 'b' });

    // Snapshot reflects the new input immediately on the very next render — no stale value.
    expect(result.current).toBe('beta');
  });
});

// -------------------- preload firing --------------------

describe('useServiceQuery — preloads', () => {
  it('fires the paired preload on subscribe', async () => {
    interface S {
      byId: Record<string, string>;
    }
    const generate = vi.fn(async (id: string) => `name-${id}`);

    const def = defineService()({
      id: 'test/hook-preload',
      state: { byId: {} } as S,
      queries: {
        getName: {
          input: z.string(),
          output: z.string().optional(),
          select: (s: S, id: string) => s.byId[id],
          preload: async (id: string, ctx: ServiceCtx<S>) => {
            await ctx.self.commands.load(id);
          },
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

    const { result } = renderHook(() => useServiceQuery(store, 'getName', 'a'));

    // First render: state hasn't loaded yet.
    expect(result.current).toBeUndefined();

    // Allow the preload to resolve + the resulting setState → signal → effect → React schedule.
    await act(async () => {
      await tick();
    });

    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledWith('a');
    expect(result.current).toBe('name-a');
  });
});
