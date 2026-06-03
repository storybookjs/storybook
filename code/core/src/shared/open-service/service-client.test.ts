import { afterEach, describe, expect, it, vi } from 'vitest';

import { mutableRecordLookupServiceDef, schemaCounterServiceDef } from './fixtures.ts';
import {
  SERVICE_PATCHES,
  SERVICE_WELCOME_REPLY,
  SERVICE_WELCOME_REQUEST,
} from './service-channel.ts';
import { clearRegistry, registerService, unregisterService } from './service-registry.ts';

// ---- Mock channel factory ----

function createMockChannel() {
  const listeners = new Map<string, Set<(data: unknown) => void>>();

  return {
    on: vi.fn((event: string, listener: (data: unknown) => void) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(listener);
    }),
    off: vi.fn((event: string, listener: (data: unknown) => void) => {
      listeners.get(event)?.delete(listener);
    }),
    emit: vi.fn((event: string, data: unknown) => {
      // Replicate a real channel: broadcast to all current listeners, including the emitter.
      for (const listener of listeners.get(event) ?? []) {
        listener(data);
      }
    }),
    // Test helper: emit an event as if it came from an external peer (different clientId).
    emitExternal(event: string, data: unknown) {
      for (const listener of listeners.get(event) ?? []) {
        listener(data);
      }
    },
  };
}

// Install a mock channel by writing the same ambient global the real runtimes read. `null` clears it
// so a channel from one test never leaks into a local-only test.
function installChannel(channel: ReturnType<typeof createMockChannel> | null): void {
  (globalThis as { __STORYBOOK_ADDONS_CHANNEL__?: unknown }).__STORYBOOK_ADDONS_CHANNEL__ =
    channel ?? undefined;
}

afterEach(() => {
  clearRegistry();
  installChannel(null);
});

// ---- Basic registration ----

describe('registerService (client)', () => {
  it('returns a service with functional queries', () => {
    const service = registerService(mutableRecordLookupServiceDef);
    expect(service.queries.getRecordFields({ entryId: 'a' })).toBeNull();
  });

  it('reflects state after a local command', async () => {
    const service = registerService(mutableRecordLookupServiceDef);

    await service.commands.assignRecordField({
      entryId: 'a',
      fieldKey: 'color',
      fieldValue: 'blue',
    });

    expect(service.queries.getRecordFields({ entryId: 'a' })).toEqual({ color: 'blue' });
  });

  it('throws on duplicate registration', () => {
    registerService(mutableRecordLookupServiceDef);

    expect(() => registerService(mutableRecordLookupServiceDef)).toThrow('already registered');
  });

  it('re-registration succeeds after unregisterServiceClient', () => {
    registerService(mutableRecordLookupServiceDef);
    unregisterService(mutableRecordLookupServiceDef.id);

    expect(() => registerService(mutableRecordLookupServiceDef)).not.toThrow();
  });
});

// ---- Subscription ----

describe('subscriptions', () => {
  it('delivers the current value immediately', async () => {
    const service = registerService(mutableRecordLookupServiceDef);
    const received: unknown[] = [];

    service.queries.getRecordFields.subscribe({ entryId: 'a' }, (v) => received.push(v));

    await vi.waitFor(() => expect(received).toHaveLength(1));
    expect(received[0]).toBeNull();
  });

  it('re-fires on state change from a local command', async () => {
    const service = registerService(mutableRecordLookupServiceDef);
    const received: unknown[] = [];

    service.queries.getRecordFields.subscribe({ entryId: 'a' }, (v) => received.push(v));
    await vi.waitFor(() => expect(received).toHaveLength(1));

    await service.commands.assignRecordField({
      entryId: 'a',
      fieldKey: 'k',
      fieldValue: 'v',
    });

    await vi.waitFor(() => expect(received).toHaveLength(2));
    expect(received[1]).toEqual({ k: 'v' });
  });
});

// ---- Channel sync ----

describe('channel: welcome handshake', () => {
  it('emits services:welcome-request on registration', () => {
    const channel = createMockChannel();
    installChannel(channel);

    registerService(mutableRecordLookupServiceDef);

    expect(channel.emit).toHaveBeenCalledWith(
      SERVICE_WELCOME_REQUEST,
      expect.objectContaining({ serviceId: mutableRecordLookupServiceDef.id })
    );
  });

  it('applies state from a welcome-reply from an external peer', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    channel.emitExternal(SERVICE_WELCOME_REPLY, {
      serviceId: mutableRecordLookupServiceDef.id,
      state: { 'entry-x': { label: 'hello' } },
      version: 1,
      clientId: 'peer-abc',
    });

    await vi.waitFor(() =>
      expect(service.queries.getRecordFields({ entryId: 'entry-x' })).toEqual({ label: 'hello' })
    );
  });

  it('responds to a welcome-request from an external peer', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    // Put some local state in
    await service.commands.assignRecordField({
      entryId: 'a',
      fieldKey: 'k',
      fieldValue: 'v',
    });

    // Another peer comes online and requests current state
    channel.emitExternal(SERVICE_WELCOME_REQUEST, {
      serviceId: mutableRecordLookupServiceDef.id,
      clientId: 'new-peer',
    });

    expect(channel.emit).toHaveBeenCalledWith(
      SERVICE_WELCOME_REPLY,
      expect.objectContaining({
        serviceId: mutableRecordLookupServiceDef.id,
        state: expect.objectContaining({ a: { k: 'v' } }),
      })
    );
  });

  it('ignores its own welcome-request echo', () => {
    const channel = createMockChannel();
    installChannel(channel);

    registerService(mutableRecordLookupServiceDef);

    // The welcome-request emitted on registration echoes back through the channel.
    // The client must NOT reply to itself.
    const replyCalls = channel.emit.mock.calls.filter(([event]) => event === SERVICE_WELCOME_REPLY);
    expect(replyCalls).toHaveLength(0);
  });

  it('adopts a welcome-reply from a hub that was not listening at registration time', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const preview = registerService(mutableRecordLookupServiceDef, undefined, {
      relay: false,
    });

    expect(channel.emit).toHaveBeenCalledWith(
      SERVICE_WELCOME_REQUEST,
      expect.objectContaining({ serviceId: mutableRecordLookupServiceDef.id })
    );

    channel.emitExternal(SERVICE_WELCOME_REPLY, {
      serviceId: mutableRecordLookupServiceDef.id,
      state: { 'entry-late': { marker: 'synced' } },
      version: 1,
      clientId: 'manager-hub',
    });

    expect(preview.queries.getRecordFields({ entryId: 'entry-late' })).toEqual({
      marker: 'synced',
    });

    expect(
      channel.emit.mock.calls.filter(([event]) => event === SERVICE_WELCOME_REQUEST).length
    ).toBe(1);
  });

  it('converges via patches when a welcome-reply carried stale v0 state', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const preview = registerService(mutableRecordLookupServiceDef, undefined, {
      relay: false,
    });

    channel.emitExternal(SERVICE_WELCOME_REPLY, {
      serviceId: mutableRecordLookupServiceDef.id,
      state: { 'entry-stale': { marker: 'v0' } },
      version: 0,
      clientId: 'early-hub',
    });

    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: mutableRecordLookupServiceDef.id,
      state: { 'entry-stale': { marker: 'v1' } },
      version: 1,
      clientId: 'early-hub',
    });

    expect(preview.queries.getRecordFields({ entryId: 'entry-stale' })).toEqual({
      marker: 'v1',
    });
  });

  it('teardown removes channel listeners after unregister', () => {
    const channel = createMockChannel();
    installChannel(channel);

    registerService(mutableRecordLookupServiceDef, undefined, { relay: false });
    unregisterService(mutableRecordLookupServiceDef.id);

    channel.emitExternal(SERVICE_WELCOME_REPLY, {
      serviceId: mutableRecordLookupServiceDef.id,
      state: { ghost: { marker: 'ignored' } },
      version: 99,
      clientId: 'after-teardown',
    });

    expect(channel.off).toHaveBeenCalled();
  });
});

describe('channel: patch broadcast', () => {
  it('broadcasts services:patches after a local command', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    await service.commands.assignRecordField({
      entryId: 'b',
      fieldKey: 'size',
      fieldValue: 'large',
    });

    expect(channel.emit).toHaveBeenCalledWith(
      SERVICE_PATCHES,
      expect.objectContaining({
        serviceId: mutableRecordLookupServiceDef.id,
        state: expect.objectContaining({ b: { size: 'large' } }),
      })
    );
  });

  it('applies patches from an external peer', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: mutableRecordLookupServiceDef.id,
      state: { 'entry-y': { marker: 'set' } },
      version: 1,
      clientId: 'peer-xyz',
    });

    await vi.waitFor(() =>
      expect(service.queries.getRecordFields({ entryId: 'entry-y' })).toEqual({ marker: 'set' })
    );
  });

  it('does not re-apply its own patch echo (loop prevention)', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    const received: unknown[] = [];
    service.queries.getRecordFields.subscribe({ entryId: 'a' }, (v) => received.push(v));
    await vi.waitFor(() => expect(received).toHaveLength(1));

    await service.commands.assignRecordField({ entryId: 'a', fieldKey: 'k', fieldValue: 'v' });
    await vi.waitFor(() => expect(received).toHaveLength(2));

    // Wait an extra tick — if a second state change fired from the loop, it would appear now.
    await new Promise<void>((resolve) => setTimeout(resolve, 20));

    expect(received).toHaveLength(2);
  });

  it('ignores patches for a different service id', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: 'some-other-service',
      state: { 'entry-z': { x: '1' } },
      version: 1,
      clientId: 'peer-xyz',
    });

    await new Promise<void>((resolve) => setTimeout(resolve, 10));

    expect(service.queries.getRecordFields({ entryId: 'entry-z' })).toBeNull();
  });
});

describe('channel: last-write-wins convergence', () => {
  it('converges on the higher clientId for concurrent (equal-version) writes', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    // Two peers write concurrently (same version). The lexicographically greater clientId wins.
    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: mutableRecordLookupServiceDef.id,
      state: { item: { color: 'red' } },
      version: 1,
      clientId: 'aaa',
    });
    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: mutableRecordLookupServiceDef.id,
      state: { item: { color: 'blue' } },
      version: 1,
      clientId: 'zzz',
    });

    await vi.waitFor(() =>
      expect(service.queries.getRecordFields({ entryId: 'item' })).toEqual({ color: 'blue' })
    );
  });

  it('converges on the same winner regardless of arrival order', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    // Greater clientId arrives first; the later, lower-clientId write at the same version loses.
    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: mutableRecordLookupServiceDef.id,
      state: { item: { color: 'blue' } },
      version: 1,
      clientId: 'zzz',
    });
    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: mutableRecordLookupServiceDef.id,
      state: { item: { color: 'red' } },
      version: 1,
      clientId: 'aaa',
    });

    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    expect(service.queries.getRecordFields({ entryId: 'item' })).toEqual({ color: 'blue' });
  });

  it('a higher version wins even against a greater clientId', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    // Greater clientId but lower version.
    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: mutableRecordLookupServiceDef.id,
      state: { item: { color: 'blue' } },
      version: 1,
      clientId: 'zzz',
    });
    // Smaller clientId but higher version — version dominates the tiebreak.
    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: mutableRecordLookupServiceDef.id,
      state: { item: { color: 'green' } },
      version: 2,
      clientId: 'aaa',
    });

    await vi.waitFor(() =>
      expect(service.queries.getRecordFields({ entryId: 'item' })).toEqual({ color: 'green' })
    );
  });

  it('drops a stale (lower-version) patch arriving after a newer one', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: mutableRecordLookupServiceDef.id,
      state: { item: { color: 'green' } },
      version: 2,
      clientId: 'peer',
    });
    // A late, stale broadcast at an older version must not overwrite the newer state.
    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: mutableRecordLookupServiceDef.id,
      state: { item: { color: 'red' } },
      version: 1,
      clientId: 'peer',
    });

    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    expect(service.queries.getRecordFields({ entryId: 'item' })).toEqual({ color: 'green' });
  });
});

describe('channel: multi-peer welcome bootstrap', () => {
  it('converges on the newest welcome-reply when several peers answer out of order', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    // Three peers reply with different versions, out of order. Only the newest must stick — this is
    // why bootstrap is version-gated rather than first-reply-wins.
    channel.emitExternal(SERVICE_WELCOME_REPLY, {
      serviceId: mutableRecordLookupServiceDef.id,
      state: { item: { v: '1' } },
      version: 1,
      clientId: 'p1',
    });
    channel.emitExternal(SERVICE_WELCOME_REPLY, {
      serviceId: mutableRecordLookupServiceDef.id,
      state: { item: { v: '3' } },
      version: 3,
      clientId: 'p3',
    });
    channel.emitExternal(SERVICE_WELCOME_REPLY, {
      serviceId: mutableRecordLookupServiceDef.id,
      state: { item: { v: '2' } },
      version: 2,
      clientId: 'p2',
    });

    await vi.waitFor(() =>
      expect(service.queries.getRecordFields({ entryId: 'item' })).toEqual({ v: '3' })
    );
  });
});

describe('channel: deletion propagation', () => {
  it('deletes keys that are absent from a newer snapshot', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: mutableRecordLookupServiceDef.id,
      state: { a: { k: 'v' }, b: { k: 'w' } },
      version: 1,
      clientId: 'peer',
    });
    await vi.waitFor(() =>
      expect(service.queries.getRecordFields({ entryId: 'b' })).toEqual({ k: 'w' })
    );

    // A newer snapshot no longer contains `b`; the reconciler must remove it locally rather than
    // leave a stale key (the old additive-only merge could never delete).
    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: mutableRecordLookupServiceDef.id,
      state: { a: { k: 'v' } },
      version: 2,
      clientId: 'peer',
    });

    await vi.waitFor(() => expect(service.queries.getRecordFields({ entryId: 'b' })).toBeNull());
    expect(service.queries.getRecordFields({ entryId: 'a' })).toEqual({ k: 'v' });
  });
});

describe('channel: untrusted payloads', () => {
  it('does not pollute Object.prototype from a hostile snapshot', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    // `JSON.parse` creates own-enumerable `__proto__`/`constructor` keys (a literal would not), so
    // this exercises the prototype-pollution guard in `deepReconcile`.
    const hostileState = JSON.parse(
      '{"good":{"k":"v"},"__proto__":{"polluted":"yes"},"constructor":{"polluted":"yes"}}'
    );

    expect(() =>
      channel.emitExternal(SERVICE_PATCHES, {
        serviceId: mutableRecordLookupServiceDef.id,
        state: hostileState,
        version: 1,
        clientId: 'attacker',
      })
    ).not.toThrow();

    // The legitimate field still applies…
    await vi.waitFor(() =>
      expect(service.queries.getRecordFields({ entryId: 'good' })).toEqual({ k: 'v' })
    );
    // …but nothing leaked onto the prototype chain.
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('drops malformed payloads without throwing or mutating state', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    const malformed: unknown[] = [
      null,
      undefined,
      42,
      'string',
      {},
      { serviceId: mutableRecordLookupServiceDef.id },
      { serviceId: mutableRecordLookupServiceDef.id, state: { a: { k: 'v' } }, clientId: 'p' },
      { serviceId: mutableRecordLookupServiceDef.id, state: { a: { k: 'v' } }, version: 1 },
      {
        serviceId: mutableRecordLookupServiceDef.id,
        state: 'not-an-object',
        version: 1,
        clientId: 'p',
      },
      { serviceId: 123, state: { a: { k: 'v' } }, version: 1, clientId: 'p' },
    ];

    for (const payload of malformed) {
      expect(() => channel.emitExternal(SERVICE_PATCHES, payload)).not.toThrow();
      expect(() => channel.emitExternal(SERVICE_WELCOME_REPLY, payload)).not.toThrow();
    }

    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    expect(service.queries.getRecordFields({ entryId: 'a' })).toBeNull();
  });
});

describe('channel: state schema validation', () => {
  it('applies a schema-valid snapshot', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(schemaCounterServiceDef);

    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: schemaCounterServiceDef.id,
      state: { a: 1, b: 2 },
      version: 1,
      clientId: 'peer',
    });

    await vi.waitFor(() => expect(service.queries.getCount({ key: 'a' })).toBe(1));
    expect(service.queries.getCount({ key: 'b' })).toBe(2);
  });

  it('drops a schema-invalid snapshot before it touches local state', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(schemaCounterServiceDef);

    // Counter values must be numbers; a string violates the state schema and must be rejected.
    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: schemaCounterServiceDef.id,
      state: { a: 'not-a-number' },
      version: 1,
      clientId: 'peer',
    });

    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    expect(service.queries.getCount({ key: 'a' })).toBeNull();
  });

  it('a newer-but-invalid snapshot cannot corrupt already-valid state', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(schemaCounterServiceDef);

    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: schemaCounterServiceDef.id,
      state: { a: 1 },
      version: 1,
      clientId: 'peer',
    });
    await vi.waitFor(() => expect(service.queries.getCount({ key: 'a' })).toBe(1));

    // Strictly newer by stamp, but invalid: it must be dropped, leaving the valid value intact.
    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: schemaCounterServiceDef.id,
      state: { a: 'corrupt' },
      version: 2,
      clientId: 'peer',
    });

    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    expect(service.queries.getCount({ key: 'a' })).toBe(1);
  });
});

describe('channel: relay role', () => {
  // The mock channel is a shared bus, so a relayed emit also bounces back to the emitter's own
  // onPatches; the version gate must recognize it as not-newer and refuse to relay it again. We
  // assert on the count of `services:patches` *emits* (relays), which `emitExternal` never produces.
  function patchEmits(channel: ReturnType<typeof createMockChannel>) {
    return channel.emit.mock.calls.filter(([event]) => event === SERVICE_PATCHES);
  }

  it('a hub re-broadcasts a peer patch it adopts, preserving the original stamp', () => {
    const channel = createMockChannel();
    installChannel(channel);

    registerService(mutableRecordLookupServiceDef, undefined, { relay: true });

    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: mutableRecordLookupServiceDef.id,
      state: { item: { color: 'red' } },
      version: 1,
      clientId: 'peer-1',
    });

    const relays = patchEmits(channel);
    expect(relays).toHaveLength(1);
    expect(relays[0][1]).toEqual(
      expect.objectContaining({
        serviceId: mutableRecordLookupServiceDef.id,
        state: expect.objectContaining({ item: { color: 'red' } }),
        version: 1,
        clientId: 'peer-1',
      })
    );
  });

  it('a leaf adopts a peer patch but never re-broadcasts it', () => {
    const channel = createMockChannel();
    installChannel(channel);

    // Default role is leaf (no relay option).
    const service = registerService(mutableRecordLookupServiceDef);

    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: mutableRecordLookupServiceDef.id,
      state: { item: { color: 'red' } },
      version: 1,
      clientId: 'peer-1',
    });

    expect(service.queries.getRecordFields({ entryId: 'item' })).toEqual({ color: 'red' });
    expect(patchEmits(channel)).toHaveLength(0);
  });

  it('a hub relays each strictly-newer version once and drops echoes (no storm)', () => {
    const channel = createMockChannel();
    installChannel(channel);

    registerService(mutableRecordLookupServiceDef, undefined, { relay: true });

    const base = { serviceId: mutableRecordLookupServiceDef.id, clientId: 'peer-1' };
    channel.emitExternal(SERVICE_PATCHES, {
      ...base,
      state: { item: { color: 'red' } },
      version: 1,
    });
    // Exact echo of v1 — already held, must not be relayed again.
    channel.emitExternal(SERVICE_PATCHES, {
      ...base,
      state: { item: { color: 'red' } },
      version: 1,
    });
    channel.emitExternal(SERVICE_PATCHES, {
      ...base,
      state: { item: { color: 'blue' } },
      version: 2,
    });

    const relays = patchEmits(channel);
    expect(relays.map(([, payload]) => (payload as { version: number }).version)).toEqual([1, 2]);
  });

  it('a hub does not relay a patch it drops as stale', () => {
    const channel = createMockChannel();
    installChannel(channel);

    registerService(mutableRecordLookupServiceDef, undefined, { relay: true });

    const base = { serviceId: mutableRecordLookupServiceDef.id, clientId: 'peer-1' };
    channel.emitExternal(SERVICE_PATCHES, {
      ...base,
      state: { item: { color: 'blue' } },
      version: 2,
    });
    // Lower version than currently held: dropped, so not relayed.
    channel.emitExternal(SERVICE_PATCHES, {
      ...base,
      state: { item: { color: 'red' } },
      version: 1,
    });

    const relays = patchEmits(channel);
    expect(relays).toHaveLength(1);
    expect((relays[0][1] as { version: number }).version).toBe(2);
  });

  it('a hub relays state it adopts from a welcome-reply', () => {
    const channel = createMockChannel();
    installChannel(channel);

    registerService(mutableRecordLookupServiceDef, undefined, { relay: true });

    // A leaf peer's welcome-reply only reaches the hub; the hub must forward it so peers on its
    // other transports converge too.
    channel.emitExternal(SERVICE_WELCOME_REPLY, {
      serviceId: mutableRecordLookupServiceDef.id,
      state: { item: { color: 'green' } },
      version: 5,
      clientId: 'peer-1',
    });

    const relays = patchEmits(channel);
    expect(relays).toHaveLength(1);
    expect(relays[0][1]).toEqual(
      expect.objectContaining({
        state: expect.objectContaining({ item: { color: 'green' } }),
        version: 5,
        clientId: 'peer-1',
      })
    );
  });
});

describe('channel: disconnect on unregister', () => {
  it('stops listening after unregisterServiceClient', () => {
    const channel = createMockChannel();
    installChannel(channel);

    registerService(mutableRecordLookupServiceDef);
    unregisterService(mutableRecordLookupServiceDef.id);

    // All three event listeners should have been torn down
    expect(channel.off).toHaveBeenCalledWith(SERVICE_WELCOME_REQUEST, expect.any(Function));
    expect(channel.off).toHaveBeenCalledWith(SERVICE_WELCOME_REPLY, expect.any(Function));
    expect(channel.off).toHaveBeenCalledWith(SERVICE_PATCHES, expect.any(Function));
  });
});

describe('no channel installed', () => {
  it('service works normally without a channel', async () => {
    const service = registerService(mutableRecordLookupServiceDef);

    await service.commands.assignRecordField({
      entryId: 'c',
      fieldKey: 'val',
      fieldValue: 'local',
    });

    expect(service.queries.getRecordFields({ entryId: 'c' })).toEqual({ val: 'local' });
  });
});
