/**
 * Channel sync tests for the default leaf registration path (`relay: false`).
 *
 * Hub (dev-server) behavior lives in {@link ./service-registration-sync.test.ts}.
 * Runtime queries, subscriptions, and registry metadata live in
 * {@link ./service-runtime.test.ts} and {@link ./service-registration.test.ts}.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { mutableRecordLookupServiceDef, schemaCounterServiceDef } from './fixtures.ts';
import {
  clearServiceChannel,
  SERVICE_PATCHES,
  SERVICE_SYNC_START_REPLY,
  SERVICE_SYNC_START,
  setServiceChannel,
} from './service-channel.ts';
import { clearRegistry, registerService, unregisterService } from './service-registry.ts';

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
      for (const listener of listeners.get(event) ?? []) {
        listener(data);
      }
    }),
    emitExternal(event: string, data: unknown) {
      for (const listener of listeners.get(event) ?? []) {
        listener(data);
      }
    },
  };
}

function installChannel(channel: ReturnType<typeof createMockChannel> | null): void {
  if (channel === null) {
    clearServiceChannel();
  } else {
    setServiceChannel(channel);
  }
}

afterEach(() => {
  clearRegistry();
  installChannel(null);
});

describe('registerService (leaf)', () => {
  it('allows re-registration after unregisterService', () => {
    registerService(mutableRecordLookupServiceDef);
    unregisterService(mutableRecordLookupServiceDef.id);

    expect(() => registerService(mutableRecordLookupServiceDef)).not.toThrow();
  });
});

describe('channel: sync-start initialization (leaf)', () => {
  it('adopts a sync-start-reply from a hub that was not listening at registration time', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const preview = registerService(mutableRecordLookupServiceDef, undefined, {
      relay: false,
    });

    expect(channel.emit).toHaveBeenCalledWith(
      SERVICE_SYNC_START,
      expect.objectContaining({ serviceId: mutableRecordLookupServiceDef.id })
    );

    channel.emitExternal(SERVICE_SYNC_START_REPLY, {
      serviceId: mutableRecordLookupServiceDef.id,
      state: { 'entry-late': { marker: 'synced' } },
      version: 1,
      clientId: 'manager-hub',
    });

    expect(preview.queries.getRecordFields({ entryId: 'entry-late' })).toEqual({
      marker: 'synced',
    });

    expect(channel.emit.mock.calls.filter(([event]) => event === SERVICE_SYNC_START).length).toBe(
      1
    );
  });

  it('converges via patches when a sync-start-reply carried stale v0 state', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const preview = registerService(mutableRecordLookupServiceDef, undefined, {
      relay: false,
    });

    channel.emitExternal(SERVICE_SYNC_START_REPLY, {
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
});

describe('channel: patch broadcast (leaf)', () => {
  it('does not re-apply its own patch echo (loop prevention)', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    const received: unknown[] = [];
    service.queries.getRecordFields.subscribe({ entryId: 'a' }, (v) => received.push(v));
    await vi.waitFor(() => expect(received).toHaveLength(1));

    await service.commands.assignRecordField({ entryId: 'a', fieldKey: 'k', fieldValue: 'v' });
    await vi.waitFor(() => expect(received).toHaveLength(2));

    await new Promise<void>((resolve) => setTimeout(resolve, 20));

    expect(received).toHaveLength(2);
  });
});

describe('channel: last-write-wins convergence', () => {
  it('converges on the higher clientId for concurrent (equal-version) writes', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

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

    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: mutableRecordLookupServiceDef.id,
      state: { item: { color: 'blue' } },
      version: 1,
      clientId: 'zzz',
    });
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

describe('channel: multi-peer sync-start bootstrap', () => {
  it('converges on the newest sync-start-reply when several peers answer out of order', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    channel.emitExternal(SERVICE_SYNC_START_REPLY, {
      serviceId: mutableRecordLookupServiceDef.id,
      state: { item: { v: '1' } },
      version: 1,
      clientId: 'p1',
    });
    channel.emitExternal(SERVICE_SYNC_START_REPLY, {
      serviceId: mutableRecordLookupServiceDef.id,
      state: { item: { v: '3' } },
      version: 3,
      clientId: 'p3',
    });
    channel.emitExternal(SERVICE_SYNC_START_REPLY, {
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

    await vi.waitFor(() =>
      expect(service.queries.getRecordFields({ entryId: 'good' })).toEqual({ k: 'v' })
    );
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('drops malformed sync-start-reply and patch payloads without mutating state', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    const malformed: unknown[] = [
      null,
      {},
      { serviceId: mutableRecordLookupServiceDef.id, state: { a: { k: 'v' } }, clientId: 'p' },
      {
        serviceId: mutableRecordLookupServiceDef.id,
        state: 'not-an-object',
        version: 1,
        clientId: 'p',
      },
    ];

    for (const payload of malformed) {
      expect(() => channel.emitExternal(SERVICE_PATCHES, payload)).not.toThrow();
      expect(() => channel.emitExternal(SERVICE_SYNC_START_REPLY, payload)).not.toThrow();
    }

    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    expect(service.queries.getRecordFields({ entryId: 'a' })).toBeNull();
  });
});

describe('channel: state schema validation', () => {
  it('drops a schema-invalid snapshot before it touches local state', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(schemaCounterServiceDef);

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

describe('channel: relay role (leaf)', () => {
  function patchEmits(channel: ReturnType<typeof createMockChannel>) {
    return channel.emit.mock.calls.filter(([event]) => event === SERVICE_PATCHES);
  }

  it('adopts a peer patch but never re-broadcasts it', () => {
    const channel = createMockChannel();
    installChannel(channel);

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
});

describe('channel: disconnect on unregister', () => {
  it('detaches listeners and ignores later peer patches', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: mutableRecordLookupServiceDef.id,
      state: { entry: { marker: 'before' } },
      version: 1,
      clientId: 'peer',
    });
    await vi.waitFor(() =>
      expect(service.queries.getRecordFields({ entryId: 'entry' })).toEqual({ marker: 'before' })
    );

    unregisterService(mutableRecordLookupServiceDef.id);

    expect(channel.off).toHaveBeenCalledWith(SERVICE_SYNC_START, expect.any(Function));
    expect(channel.off).toHaveBeenCalledWith(SERVICE_SYNC_START_REPLY, expect.any(Function));
    expect(channel.off).toHaveBeenCalledWith(SERVICE_PATCHES, expect.any(Function));

    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: mutableRecordLookupServiceDef.id,
      state: { entry: { marker: 'after' } },
      version: 2,
      clientId: 'peer',
    });

    expect(service.queries.getRecordFields({ entryId: 'entry' })).toEqual({ marker: 'before' });
  });
});
