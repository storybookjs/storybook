import { afterEach, describe, expect, it, vi } from 'vitest';

import { mutableRecordLookupServiceDef, schemaCounterServiceDef } from './fixtures.ts';
import {
  SERVICE_PATCHES,
  SERVICE_WELCOME_REPLY,
  SERVICE_WELCOME_REQUEST,
} from './service-channel.ts';
import { clearRegistry, registerService } from './server.ts';

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
    // Test helper: emit an event as if it came from an external peer (different clientId). Unlike
    // `emit`, this is NOT recorded in `emit.mock.calls`, so assertions can count only our own emits.
    emitExternal(event: string, data: unknown) {
      for (const listener of listeners.get(event) ?? []) {
        listener(data);
      }
    },
  };
}

const { id: recordServiceId } = mutableRecordLookupServiceDef;

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

// These tests exercise the server transport that `registerService` wires when a channel is present on
// `globalThis.__STORYBOOK_ADDONS_CHANNEL__` BEFORE registration — the dev server installs it in its
// `services` preset, so there is no separate connect step. The server is always a relay hub: one dev
// server bridges every connected manager tab.

describe('registerService: channel wiring', () => {
  it('wires the installed channel listeners on registration', () => {
    const channel = createMockChannel();
    installChannel(channel);

    registerService(mutableRecordLookupServiceDef);

    expect(channel.on).toHaveBeenCalledWith(SERVICE_WELCOME_REQUEST, expect.any(Function));
    expect(channel.on).toHaveBeenCalledWith(SERVICE_WELCOME_REPLY, expect.any(Function));
    expect(channel.on).toHaveBeenCalledWith(SERVICE_PATCHES, expect.any(Function));
  });

  it('stays local-only when no channel is installed', async () => {
    const channel = createMockChannel();
    // Intentionally NOT calling setServiceChannel: the runtime must operate in isolation.
    const service = registerService(mutableRecordLookupServiceDef);

    await service.commands.assignRecordField({ entryId: 'a', fieldKey: 'k', fieldValue: 'v' });

    expect(service.queries.getRecordFields({ entryId: 'a' })).toEqual({ k: 'v' });
    expect(channel.on).not.toHaveBeenCalled();
    expect(channel.emit).not.toHaveBeenCalled();
  });
});

describe('server: command push', () => {
  it('broadcasts the post-mutation snapshot after a local command', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    await service.commands.assignRecordField({ entryId: 'a', fieldKey: 'k', fieldValue: 'v' });

    const patches = channel.emit.mock.calls.filter(([event]) => event === SERVICE_PATCHES);
    // Exactly one: the broadcast echoes back on the shared bus, but its equal stamp fails `isNewer`
    // so it is dropped instead of re-broadcast.
    expect(patches).toHaveLength(1);
    expect(patches[0][1]).toEqual(
      expect.objectContaining({
        serviceId: recordServiceId,
        state: expect.objectContaining({ a: { k: 'v' } }),
        version: 1,
        clientId: expect.any(String),
      })
    );
    expect(service.queries.getRecordFields({ entryId: 'a' })).toEqual({ k: 'v' });
  });

  it('advances the version on each subsequent command, keeping a stable clientId', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    await service.commands.assignRecordField({ entryId: 'a', fieldKey: 'k', fieldValue: '1' });
    await service.commands.assignRecordField({ entryId: 'a', fieldKey: 'k', fieldValue: '2' });

    const patches = channel.emit.mock.calls.filter(([event]) => event === SERVICE_PATCHES);
    expect(patches.map(([, p]) => (p as { version: number }).version)).toEqual([1, 2]);
    expect((patches[1][1] as { clientId: string }).clientId).toBe(
      (patches[0][1] as { clientId: string }).clientId
    );
    expect(service.queries.getRecordFields({ entryId: 'a' })).toEqual({ k: '2' });
  });
});

describe('server: welcome handshake', () => {
  it('replies to a welcome-request with its current snapshot and stamp', () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    // Server adopts a peer patch: this both populates state and advances the server's stamp to the
    // peer's (version, clientId).
    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: recordServiceId,
      state: { a: { k: 'v' } },
      version: 1,
      clientId: 'peer-1',
    });
    expect(service.queries.getRecordFields({ entryId: 'a' })).toEqual({ k: 'v' });

    // A different peer comes online and asks for current state; the server answers with the snapshot
    // it now holds, stamped with the version/clientId it adopted (not its own initial clientId).
    channel.emitExternal(SERVICE_WELCOME_REQUEST, {
      serviceId: recordServiceId,
      clientId: 'peer-2',
    });

    expect(channel.emit).toHaveBeenCalledWith(
      SERVICE_WELCOME_REPLY,
      expect.objectContaining({
        serviceId: recordServiceId,
        state: expect.objectContaining({ a: { k: 'v' } }),
        version: 1,
        clientId: 'peer-1',
      })
    );
  });

  it('does not reply to a welcome-request for a different service id', () => {
    const channel = createMockChannel();
    installChannel(channel);

    registerService(mutableRecordLookupServiceDef);

    channel.emitExternal(SERVICE_WELCOME_REQUEST, {
      serviceId: 'some-other-service',
      clientId: 'peer-2',
    });

    const replyCalls = channel.emit.mock.calls.filter(([event]) => event === SERVICE_WELCOME_REPLY);
    expect(replyCalls).toHaveLength(0);
  });
});

describe('server: patch application', () => {
  it('applies a version-gated patch from a peer', () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: recordServiceId,
      state: { entry: { marker: 'set' } },
      version: 1,
      clientId: 'peer',
    });

    expect(service.queries.getRecordFields({ entryId: 'entry' })).toEqual({ marker: 'set' });
  });

  it('drops a stale (lower-version) patch arriving after a newer one', () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: recordServiceId,
      state: { entry: { marker: 'new' } },
      version: 2,
      clientId: 'peer',
    });
    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: recordServiceId,
      state: { entry: { marker: 'stale' } },
      version: 1,
      clientId: 'peer',
    });

    expect(service.queries.getRecordFields({ entryId: 'entry' })).toEqual({ marker: 'new' });
  });

  it('ignores patches for a different service id', () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: 'some-other-service',
      state: { entry: { x: '1' } },
      version: 1,
      clientId: 'peer',
    });

    expect(service.queries.getRecordFields({ entryId: 'entry' })).toBeNull();
  });

  it('drops malformed patches without throwing or mutating state', () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    const malformed: unknown[] = [
      null,
      {},
      { serviceId: recordServiceId, state: { a: { k: 'v' } }, clientId: 'p' },
      { serviceId: recordServiceId, state: 'nope', version: 1, clientId: 'p' },
    ];

    for (const payload of malformed) {
      expect(() => channel.emitExternal(SERVICE_PATCHES, payload)).not.toThrow();
    }

    expect(service.queries.getRecordFields({ entryId: 'a' })).toBeNull();
  });
});

describe('server: state schema validation', () => {
  it('applies a schema-valid snapshot and drops an invalid one', () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(schemaCounterServiceDef);

    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: schemaCounterServiceDef.id,
      state: { a: 1 },
      version: 1,
      clientId: 'peer',
    });
    expect(service.queries.getCount({ key: 'a' })).toBe(1);

    // Strictly newer by stamp, but the value violates the state schema; the shared reconciler must
    // reject it on the server exactly as it does on the client.
    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: schemaCounterServiceDef.id,
      state: { a: 'corrupt' },
      version: 2,
      clientId: 'peer',
    });
    expect(service.queries.getCount({ key: 'a' })).toBe(1);
  });
});

describe('server: teardown via clearRegistry', () => {
  it('detaches channel listeners so later patches are ignored', () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: recordServiceId,
      state: { entry: { marker: 'set' } },
      version: 1,
      clientId: 'peer',
    });
    expect(service.queries.getRecordFields({ entryId: 'entry' })).toEqual({ marker: 'set' });

    clearRegistry();

    expect(channel.off).toHaveBeenCalledWith(SERVICE_WELCOME_REQUEST, expect.any(Function));
    expect(channel.off).toHaveBeenCalledWith(SERVICE_WELCOME_REPLY, expect.any(Function));
    expect(channel.off).toHaveBeenCalledWith(SERVICE_PATCHES, expect.any(Function));

    // A strictly-newer patch after teardown must not reach the now-detached runtime.
    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: recordServiceId,
      state: { entry: { marker: 'after' } },
      version: 2,
      clientId: 'peer',
    });
    expect(service.queries.getRecordFields({ entryId: 'entry' })).toEqual({ marker: 'set' });
  });
});

describe('server: bootstrap on registration', () => {
  it('emits a welcome-request so a freshly-registered server can catch up', () => {
    const channel = createMockChannel();
    installChannel(channel);

    registerService(mutableRecordLookupServiceDef);

    expect(channel.emit).toHaveBeenCalledWith(
      SERVICE_WELCOME_REQUEST,
      expect.objectContaining({ serviceId: recordServiceId })
    );
  });

  it('adopts state from a welcome-reply (a late/restarted server catches up)', () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    // A peer answers the server's bootstrap request with state authored while the server was down.
    channel.emitExternal(SERVICE_WELCOME_REPLY, {
      serviceId: recordServiceId,
      state: { a: { k: 'v' } },
      version: 3,
      clientId: 'peer-1',
    });

    expect(service.queries.getRecordFields({ entryId: 'a' })).toEqual({ k: 'v' });
  });

  it('does not treat its own welcome-request echo as incoming state', () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    // The bootstrap welcome-request echoes back through the shared bus; it must not reply to itself
    // nor mutate state. With no peer to answer, state stays empty.
    expect(service.queries.getRecordFields({ entryId: 'a' })).toBeNull();
    const replyCalls = channel.emit.mock.calls.filter(([event]) => event === SERVICE_WELCOME_REPLY);
    expect(replyCalls).toHaveLength(0);
  });
});

describe('server: relay role', () => {
  // The server is always a relay hub: one dev server bridges every connected manager tab. The mock
  // is a shared bus, so a relayed emit bounces back to the server's own onPatches; the version gate
  // must drop that echo instead of relaying it again.
  function patchEmits(channel: ReturnType<typeof createMockChannel>) {
    return channel.emit.mock.calls.filter(([event]) => event === SERVICE_PATCHES);
  }

  it('re-broadcasts a peer patch it adopts, preserving the original stamp', () => {
    const channel = createMockChannel();
    installChannel(channel);

    registerService(mutableRecordLookupServiceDef);

    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: recordServiceId,
      state: { entry: { marker: 'set' } },
      version: 1,
      clientId: 'peer-1',
    });

    const relays = patchEmits(channel);
    expect(relays).toHaveLength(1);
    expect(relays[0][1]).toEqual(
      expect.objectContaining({
        serviceId: recordServiceId,
        state: expect.objectContaining({ entry: { marker: 'set' } }),
        version: 1,
        clientId: 'peer-1',
      })
    );
  });

  it('relays state it adopts during bootstrap (welcome-reply)', () => {
    const channel = createMockChannel();
    installChannel(channel);

    registerService(mutableRecordLookupServiceDef);

    channel.emitExternal(SERVICE_WELCOME_REPLY, {
      serviceId: recordServiceId,
      state: { entry: { marker: 'boot' } },
      version: 4,
      clientId: 'peer-1',
    });

    const relays = patchEmits(channel);
    expect(relays).toHaveLength(1);
    expect((relays[0][1] as { version: number }).version).toBe(4);
  });

  it('does not relay a patch it drops as stale, and terminates on the echo', () => {
    const channel = createMockChannel();
    installChannel(channel);

    registerService(mutableRecordLookupServiceDef);

    const base = { serviceId: recordServiceId, clientId: 'peer-1' };
    channel.emitExternal(SERVICE_PATCHES, {
      ...base,
      state: { entry: { marker: 'new' } },
      version: 2,
    });
    channel.emitExternal(SERVICE_PATCHES, {
      ...base,
      state: { entry: { marker: 'stale' } },
      version: 1,
    });

    const relays = patchEmits(channel);
    expect(relays).toHaveLength(1);
    expect((relays[0][1] as { version: number }).version).toBe(2);
  });
});
