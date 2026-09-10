import { afterEach, describe, expect, it } from 'vitest';
import * as v from 'valibot';

import { OpenServiceMissingChannelError } from '../../server-errors.ts';
import { createTestChannel, installTestChannel } from '../../channels/test-channel.ts';
import { mutableRecordLookupServiceDef, noInputSchema, voidOutputSchema } from './fixtures.ts';
import { defineService } from './service-definition.ts';
import {
  SERVICE_PATCHES,
  SERVICE_SYNC_START_REPLY,
  SERVICE_SYNC_START,
} from './service-channel.ts';
import { clearRegistry, registerService } from './server.ts';

const { id: recordServiceId } = mutableRecordLookupServiceDef;

type RecorderBroadcastState = { a: number; b: number; n: number };

const recorderBroadcastServiceDef = defineService({
  id: 'internal-fixture/recorder-broadcast',
  description: 'Exercises no-op and nested-command broadcast recording.',
  initialState: { a: 0, b: 0, n: 0 } satisfies RecorderBroadcastState,
  queries: {
    snapshot: {
      description: 'Returns the full state.',
      input: noInputSchema,
      output: v.object({ a: v.number(), b: v.number(), n: v.number() }),
      handler: (_input, ctx) => ({
        a: ctx.self.state.a,
        b: ctx.self.state.b,
        n: ctx.self.state.n,
      }),
    },
  },
  commands: {
    noop: {
      description: 'Resolves without writing.',
      input: noInputSchema,
      output: voidOutputSchema,
      handler: () => undefined,
    },
    sameN: {
      description: 'Writes n to its current value.',
      input: noInputSchema,
      output: voidOutputSchema,
      handler: (_input, ctx) => {
        ctx.self.setState((state) => {
          state.n = state.n;
        });
      },
    },
    setB: {
      description: 'Writes b.',
      input: noInputSchema,
      output: voidOutputSchema,
      handler: (_input, ctx) => {
        ctx.self.setState((state) => {
          state.b = 2;
        });
      },
    },
    outer: {
      description: 'Writes a then delegates to setB.',
      input: noInputSchema,
      output: voidOutputSchema,
      handler: async (_input, ctx) => {
        ctx.self.setState((state) => {
          state.a = 1;
        });
        await ctx.self.commands.setB();
      },
    },
    setA: {
      description: 'Writes a.',
      input: noInputSchema,
      output: voidOutputSchema,
      handler: (_input, ctx) => {
        ctx.self.setState((state) => {
          state.a = 1;
        });
      },
    },
  },
});

const createMockChannel = createTestChannel;
const installChannel = installTestChannel;

afterEach(() => {
  clearRegistry();
  installChannel(null);
});

// These tests exercise the server transport that `registerService` wires when a channel is present
// BEFORE registration — the dev server installs it in its `services` preset, so there is no separate
// connect step. The server is always a relay hub: one dev server bridges every connected manager tab.

describe('registerService: channel wiring', () => {
  it('wires the installed channel listeners on registration', () => {
    const channel = createMockChannel();
    installChannel(channel);

    registerService(mutableRecordLookupServiceDef);

    expect(channel.on).toHaveBeenCalledWith(SERVICE_SYNC_START, expect.any(Function));
    expect(channel.on).toHaveBeenCalledWith(SERVICE_SYNC_START_REPLY, expect.any(Function));
    expect(channel.on).toHaveBeenCalledWith(SERVICE_PATCHES, expect.any(Function));
  });

  it('throws when the addons channel is not installed', () => {
    installChannel(null);

    expect(() => registerService(mutableRecordLookupServiceDef)).toThrow(
      OpenServiceMissingChannelError
    );
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
    expect(service.queries.recordFields.get({ entryId: 'a' })).toEqual({ k: 'v' });
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
    expect(service.queries.recordFields.get({ entryId: 'a' })).toEqual({ k: '2' });
  });

  it('emits no sync frame and does not bump the stamp for a command that writes nothing', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(recorderBroadcastServiceDef);

    await service.commands.noop();
    await service.commands.sameN();

    expect(channel.emit.mock.calls.filter(([event]) => event === SERVICE_PATCHES)).toHaveLength(0);

    await service.commands.setA();

    const patches = channel.emit.mock.calls.filter(([event]) => event === SERVICE_PATCHES);
    expect(patches).toHaveLength(1);
    expect((patches[0][1] as { version: number }).version).toBe(1);
    expect(service.queries.snapshot.get()).toEqual({ a: 1, b: 0, n: 0 });
  });

  it('emits exactly one frame per outer invocation including nested command writes', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(recorderBroadcastServiceDef);

    await service.commands.outer();

    const patches = channel.emit.mock.calls.filter(([event]) => event === SERVICE_PATCHES);
    expect(patches).toHaveLength(1);
    expect(patches[0][1]).toEqual(
      expect.objectContaining({
        serviceId: recorderBroadcastServiceDef.id,
        state: expect.objectContaining({ a: 1, b: 2, n: 0 }),
        version: 1,
      })
    );
    expect(service.queries.snapshot.get()).toEqual({ a: 1, b: 2, n: 0 });
  });
});

describe('server: sync-start initialization', () => {
  it('replies to a sync-start with its current snapshot and stamp', () => {
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
    expect(service.queries.recordFields.get({ entryId: 'a' })).toEqual({ k: 'v' });

    // A different peer comes online and asks for current state; the server answers with the snapshot
    // it now holds, stamped with the version/clientId it adopted (not its own initial clientId).
    channel.emitExternal(SERVICE_SYNC_START, {
      serviceId: recordServiceId,
      clientId: 'peer-2',
    });

    expect(channel.emit).toHaveBeenCalledWith(
      SERVICE_SYNC_START_REPLY,
      expect.objectContaining({
        serviceId: recordServiceId,
        state: expect.objectContaining({ a: { k: 'v' } }),
        version: 1,
        clientId: 'peer-1',
      })
    );
  });

  it('does not reply to a sync-start for a different service id', () => {
    const channel = createMockChannel();
    installChannel(channel);

    registerService(mutableRecordLookupServiceDef);

    channel.emitExternal(SERVICE_SYNC_START, {
      serviceId: 'some-other-service',
      clientId: 'peer-2',
    });

    const replyCalls = channel.emit.mock.calls.filter(
      ([event]) => event === SERVICE_SYNC_START_REPLY
    );
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

    expect(service.queries.recordFields.get({ entryId: 'entry' })).toEqual({ marker: 'set' });
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

    expect(service.queries.recordFields.get({ entryId: 'entry' })).toEqual({ marker: 'new' });
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

    expect(service.queries.recordFields.get({ entryId: 'entry' })).toBeNull();
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

    expect(service.queries.recordFields.get({ entryId: 'a' })).toBeNull();
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
    expect(service.queries.recordFields.get({ entryId: 'entry' })).toEqual({ marker: 'set' });

    clearRegistry();

    expect(channel.off).toHaveBeenCalledWith(SERVICE_SYNC_START, expect.any(Function));
    expect(channel.off).toHaveBeenCalledWith(SERVICE_SYNC_START_REPLY, expect.any(Function));
    expect(channel.off).toHaveBeenCalledWith(SERVICE_PATCHES, expect.any(Function));

    // A strictly-newer patch after teardown must not reach the now-detached runtime.
    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: recordServiceId,
      state: { entry: { marker: 'after' } },
      version: 2,
      clientId: 'peer',
    });
    expect(service.queries.recordFields.get({ entryId: 'entry' })).toEqual({ marker: 'set' });
  });
});

describe('server: bootstrap on registration', () => {
  it('emits a sync-start so a freshly-registered server can catch up', () => {
    const channel = createMockChannel();
    installChannel(channel);

    registerService(mutableRecordLookupServiceDef);

    expect(channel.emit).toHaveBeenCalledWith(
      SERVICE_SYNC_START,
      expect.objectContaining({ serviceId: recordServiceId })
    );
  });

  it('adopts state from a sync-start-reply (a late/restarted server catches up)', () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    // A peer answers the server's bootstrap request with state authored while the server was down.
    channel.emitExternal(SERVICE_SYNC_START_REPLY, {
      serviceId: recordServiceId,
      state: { a: { k: 'v' } },
      version: 3,
      clientId: 'peer-1',
    });

    expect(service.queries.recordFields.get({ entryId: 'a' })).toEqual({ k: 'v' });
  });

  it('does not treat its own sync-start echo as incoming state', () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    // The bootstrap sync-start echoes back through the shared bus; it must not reply to itself
    // nor mutate state. With no peer to answer, state stays empty.
    expect(service.queries.recordFields.get({ entryId: 'a' })).toBeNull();
    const replyCalls = channel.emit.mock.calls.filter(
      ([event]) => event === SERVICE_SYNC_START_REPLY
    );
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

  it('relays state it adopts during bootstrap (sync-start-reply)', () => {
    const channel = createMockChannel();
    installChannel(channel);

    registerService(mutableRecordLookupServiceDef);

    channel.emitExternal(SERVICE_SYNC_START_REPLY, {
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
