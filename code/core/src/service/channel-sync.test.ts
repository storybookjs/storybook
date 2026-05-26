import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearServiceChannel,
  setServiceChannel,
  type ServiceChannel,
} from './channel-transport.ts';
import { defineQuery, defineService } from './define-service.ts';
import { __resetServiceRegistry, registerService } from './register-service.ts';
import { ServiceRuntime } from './service-runtime.ts';
import type { ServiceCtx } from './types.ts';

/**
 * Minimal in-process channel implementation. Synchronous fanout: every listener fires before
 * `emit` returns. Matches the surface of Storybook's `Channel` (`on`/`off`/`emit`) without
 * pulling that dep into the test.
 */
function makeChannel(): ServiceChannel & { _listeners: Map<string, Set<(d: any) => void>> } {
  const listeners = new Map<string, Set<(d: any) => void>>();
  return {
    _listeners: listeners,
    on(event, listener) {
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(listener);
    },
    off(event, listener) {
      listeners.get(event)?.delete(listener);
    },
    emit(event, data) {
      const set = listeners.get(event);
      if (!set) return;
      // Copy to allow handlers to mutate the set (add/remove) without breaking iteration.
      for (const l of [...set]) l(data);
    },
  };
}

afterEach(() => {
  __resetServiceRegistry();
  clearServiceChannel();
});

// -------------------- isolation (no channel installed) --------------------

describe('isolation — no channel installed', () => {
  it('registration emits nothing and the runtime works exactly as before', async () => {
    interface S {
      n: number;
    }
    const def = defineService<S>()({
      id: 'test/isolation-no-channel',
      state: { n: 0 },
      queries: { get: defineQuery({ select: (s) => s.n }) },
      commands: {
        bump: (ctx) =>
          ctx.self.setState((d: S) => {
            d.n += 1;
          }),
      },
    });

    const store = registerService(def);
    expect(store.queries.get()).toBe(0);
    await store.commands.bump();
    expect(store.queries.get()).toBe(1);
  });
});

// -------------------- welcome handshake --------------------

describe('welcome handshake', () => {
  it('a runtime joining late receives current state from a peer that already has it', async () => {
    interface S {
      counter: number;
      byId: Record<string, string>;
    }
    const def = defineService<S>()({
      id: 'test/welcome-handshake',
      state: { counter: 0, byId: {} },
      queries: { get: defineQuery({ select: (s) => s }) },
      commands: {
        seed: (ctx) =>
          ctx.self.setState((d: S) => {
            d.counter = 7;
            d.byId.a = 'alpha';
          }),
      },
    });

    const channel = makeChannel();
    setServiceChannel(channel);

    // First runtime: mutate state so it has something to offer.
    const seeded = new ServiceRuntime(def);
    await seeded.commands.seed();
    expect(seeded.getState()).toEqual({ counter: 7, byId: { a: 'alpha' } });

    // Late joiner: should announce, receive the welcome, and merge.
    const joiner = new ServiceRuntime(def);

    expect(joiner.getState()).toEqual({ counter: 7, byId: { a: 'alpha' } });

    seeded.dispose();
    joiner.dispose();
  });

  it('multiple peers replying is idempotent — deep-merge of identical state is a no-op', async () => {
    interface S {
      n: number;
    }
    const def = defineService<S>()({
      id: 'test/welcome-multi-reply',
      state: { n: 0 },
      queries: { get: defineQuery({ select: (s) => s.n }) },
      commands: {
        set: (n: number, ctx) =>
          ctx.self.setState((d: S) => {
            d.n = n;
          }),
      },
    });

    const channel = makeChannel();
    setServiceChannel(channel);

    const peerA = new ServiceRuntime(def);
    const peerB = new ServiceRuntime(def);
    await peerA.commands.set(42);
    // peerB receives the ongoing patch and now also has 42.
    expect(peerB.getState()).toEqual({ n: 42 });

    // Late joiner: both peerA and peerB reply with welcome carrying {n: 42}. The deep-merge
    // is applied twice but is idempotent — final state is what we'd expect.
    const joiner = new ServiceRuntime(def);
    expect(joiner.getState()).toEqual({ n: 42 });
  });

  it('does nothing when no peer is connected (isolated runtime)', async () => {
    interface S {
      n: number;
    }
    const def = defineService<S>()({
      id: 'test/welcome-isolated',
      state: { n: 5 },
      queries: { get: defineQuery({ select: (s) => s.n }) },
      commands: {},
    });

    const channel = makeChannel();
    setServiceChannel(channel);

    // Sole runtime, no peers. Welcome request goes out and is ignored (no listeners yet on
    // any other runtime). State stays at initial.
    const lonely = new ServiceRuntime(def);
    expect(lonely.getState()).toEqual({ n: 5 });
  });
});

// -------------------- ongoing patch sync --------------------

describe('ongoing patch sync', () => {
  it('a setState on one runtime propagates as patches to the other', async () => {
    interface S {
      byId: Record<string, string>;
    }
    const def = defineService<S>()({
      id: 'test/ongoing-sync',
      state: { byId: {} },
      queries: { getOne: defineQuery({ select: (s, id: string) => s.byId[id] }) },
      commands: {
        set: (input: { id: string; name: string }, ctx) =>
          ctx.self.setState((d: S) => {
            d.byId[input.id] = input.name;
          }),
      },
    });

    const channel = makeChannel();
    setServiceChannel(channel);

    const a = new ServiceRuntime(def);
    const b = new ServiceRuntime(def);

    const aListener = vi.fn();
    const bListener = vi.fn();
    a.queries.getOne.subscribe('x', aListener);
    b.queries.getOne.subscribe('x', bListener);

    await a.commands.set({ id: 'x', name: 'on-a' });

    // a saw its own mutation; b saw the propagated patch and notified its subscriber.
    expect(a.queries.getOne('x')).toBe('on-a');
    expect(b.queries.getOne('x')).toBe('on-a');
    expect(aListener).toHaveBeenLastCalledWith('on-a');
    expect(bListener).toHaveBeenLastCalledWith('on-a');

    a.dispose();
    b.dispose();
  });

  it('loop suppression: receiving patches does NOT re-broadcast them', async () => {
    interface S {
      n: number;
    }
    const def = defineService<S>()({
      id: 'test/loop-suppression',
      state: { n: 0 },
      queries: { get: defineQuery({ select: (s) => s.n }) },
      commands: {
        bump: (ctx) =>
          ctx.self.setState((d: S) => {
            d.n += 1;
          }),
      },
    });

    const channel = makeChannel();
    const emitSpy = vi.spyOn(channel, 'emit');
    setServiceChannel(channel);

    const a = new ServiceRuntime(def);
    const b = new ServiceRuntime(def);

    // Welcome-request emissions from a and b plus their welcome-replies happen during
    // construction. Reset the count so we can isolate the next mutation's broadcasts.
    emitSpy.mockClear();

    await a.commands.bump();

    // Exactly one patches event went over the wire: a's broadcast. b applied it locally
    // but did NOT re-broadcast (loop-suppression worked).
    const patchEvents = emitSpy.mock.calls.filter((c) => c[0] === 'services:patches');
    expect(patchEvents).toHaveLength(1);

    a.dispose();
    b.dispose();
  });

  it('removals propagate via Immer applyPatches (state-shaped diffs would lose them)', async () => {
    interface S {
      byId: Record<string, string>;
    }
    const def = defineService<S>()({
      id: 'test/removal-sync',
      state: { byId: { a: 'alpha', b: 'beta' } },
      queries: { getOne: defineQuery({ select: (s, id: string) => s.byId[id] }) },
      commands: {
        remove: (id: string, ctx) =>
          ctx.self.setState((d: S) => {
            delete d.byId[id];
          }),
      },
    });

    const channel = makeChannel();
    setServiceChannel(channel);

    const a = new ServiceRuntime(def);
    const b = new ServiceRuntime(def);

    expect(b.queries.getOne('a')).toBe('alpha');

    await a.commands.remove('a');

    expect(a.queries.getOne('a')).toBe(undefined);
    expect(b.queries.getOne('a')).toBe(undefined);

    a.dispose();
    b.dispose();
  });
});

// -------------------- service-id filtering --------------------

describe('service-id filtering', () => {
  it('a runtime ignores welcome-requests and patches for other service ids', async () => {
    interface S {
      n: number;
    }
    const defA = defineService<S>()({
      id: 'test/svc-A',
      state: { n: 0 },
      queries: { get: defineQuery({ select: (s) => s.n }) },
      commands: {
        set: (n: number, ctx) =>
          ctx.self.setState((d: S) => {
            d.n = n;
          }),
      },
    });
    const defB = defineService<S>()({
      id: 'test/svc-B',
      state: { n: 100 },
      queries: { get: defineQuery({ select: (s) => s.n }) },
      commands: {
        set: (n: number, ctx) =>
          ctx.self.setState((d: S) => {
            d.n = n;
          }),
      },
    });

    const channel = makeChannel();
    setServiceChannel(channel);

    const a = new ServiceRuntime(defA);
    const b = new ServiceRuntime(defB);

    await a.commands.set(42);

    // A changed; B did NOT change because the patch's serviceId didn't match.
    expect(a.queries.get()).toBe(42);
    expect(b.queries.get()).toBe(100);

    a.dispose();
    b.dispose();
  });
});
