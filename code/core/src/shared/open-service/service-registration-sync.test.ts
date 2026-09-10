import { afterEach, describe, expect, it } from 'vitest';
import * as v from 'valibot';

import { OpenServiceMissingChannelError } from '../../server-errors.ts';
import { createTestChannel, installTestChannel } from '../../channels/test-channel.ts';
import { mutableRecordLookupServiceDef, noInputSchema, voidOutputSchema } from './fixtures.ts';
import { defineService } from './service-definition.ts';
import { SERVICE_ENTRY, SERVICE_SYNC_START_REPLY, SERVICE_SYNC_START } from './service-channel.ts';
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

function peerEntry(
  serviceId: string,
  patch: Array<
    { op: 'add' | 'replace'; path: string; value: unknown } | { op: 'remove'; path: string }
  >,
  stamp: { runtimeId: string; counter: number },
  extras: Record<string, unknown> = {}
) {
  return {
    serviceId,
    stamp,
    command: 'assignRecordField',
    patch,
    ...extras,
  };
}

function entryEmits(channel: ReturnType<typeof createMockChannel>) {
  return channel.emit.mock.calls.filter(([event]) => event === SERVICE_ENTRY);
}

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
    expect(channel.on).toHaveBeenCalledWith(SERVICE_ENTRY, expect.any(Function));
  });

  it('throws when the addons channel is not installed', () => {
    installChannel(null);

    expect(() => registerService(mutableRecordLookupServiceDef)).toThrow(
      OpenServiceMissingChannelError
    );
  });
});

describe('server: command push', () => {
  it('broadcasts a services:entry after a local command', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    await service.commands.assignRecordField({ entryId: 'a', fieldKey: 'k', fieldValue: 'v' });

    const entries = entryEmits(channel);
    expect(entries).toHaveLength(1);
    expect(entries[0][1]).toEqual(
      expect.objectContaining({
        serviceId: recordServiceId,
        command: 'assignRecordField',
        stamp: expect.objectContaining({ runtimeId: expect.any(String), counter: 1 }),
        patch: [{ op: 'add', path: '/a', value: { k: 'v' } }],
      })
    );
    expect(service.queries.recordFields.get({ entryId: 'a' })).toEqual({ k: 'v' });
  });

  it('advances the counter on each subsequent command, keeping a stable runtimeId', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    await service.commands.assignRecordField({ entryId: 'a', fieldKey: 'k', fieldValue: '1' });
    await service.commands.assignRecordField({ entryId: 'a', fieldKey: 'k', fieldValue: '2' });

    const entries = entryEmits(channel);
    expect(
      entries.map(([, payload]) => (payload as { stamp: { counter: number } }).stamp.counter)
    ).toEqual([1, 2]);
    expect((entries[1][1] as { stamp: { runtimeId: string } }).stamp.runtimeId).toBe(
      (entries[0][1] as { stamp: { runtimeId: string } }).stamp.runtimeId
    );
    expect(service.queries.recordFields.get({ entryId: 'a' })).toEqual({ k: '2' });
  });

  it('emits no sync frame and does not bump the stamp for a command that writes nothing', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(recorderBroadcastServiceDef);

    await service.commands.noop();
    await service.commands.sameN();

    expect(entryEmits(channel)).toHaveLength(0);

    await service.commands.setA();

    const entries = entryEmits(channel);
    expect(entries).toHaveLength(1);
    expect((entries[0][1] as { stamp: { counter: number } }).stamp.counter).toBe(1);
    expect(service.queries.snapshot.get()).toEqual({ a: 1, b: 0, n: 0 });
  });

  it('emits exactly one frame per outer invocation including nested command writes', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(recorderBroadcastServiceDef);

    await service.commands.outer();

    const entries = entryEmits(channel);
    expect(entries).toHaveLength(1);
    expect(entries[0][1]).toEqual(
      expect.objectContaining({
        serviceId: recorderBroadcastServiceDef.id,
        command: 'outer',
        stamp: expect.objectContaining({ counter: 1 }),
        patch: expect.arrayContaining([
          { op: 'replace', path: '/a', value: 1 },
          { op: 'replace', path: '/b', value: 2 },
        ]),
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

    // Server adopts a peer entry: this both populates state and advances the server's snapshot stamp.
    channel.emitExternal(
      SERVICE_ENTRY,
      peerEntry(recordServiceId, [{ op: 'add', path: '/a', value: { k: 'v' } }], {
        runtimeId: 'peer-1',
        counter: 1,
      })
    );
    expect(service.queries.recordFields.get({ entryId: 'a' })).toEqual({ k: 'v' });

    // A different peer comes online and asks for current state; the server answers with the snapshot
    // it now holds, stamped with the version/runtimeId it adopted (not its own initial runtimeId).
    channel.emitExternal(SERVICE_SYNC_START, {
      serviceId: recordServiceId,
      runtimeId: 'peer-2',
    });

    expect(channel.emit).toHaveBeenCalledWith(
      SERVICE_SYNC_START_REPLY,
      expect.objectContaining({
        serviceId: recordServiceId,
        state: expect.objectContaining({ a: { k: 'v' } }),
        version: 1,
        runtimeId: 'peer-1',
      })
    );
  });

  it('does not reply to a sync-start for a different service id', () => {
    const channel = createMockChannel();
    installChannel(channel);

    registerService(mutableRecordLookupServiceDef);

    channel.emitExternal(SERVICE_SYNC_START, {
      serviceId: 'some-other-service',
      runtimeId: 'peer-2',
    });

    const replyCalls = channel.emit.mock.calls.filter(
      ([event]) => event === SERVICE_SYNC_START_REPLY
    );
    expect(replyCalls).toHaveLength(0);
  });
});

describe('server: entry application', () => {
  it('applies an entry from a peer', () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    channel.emitExternal(
      SERVICE_ENTRY,
      peerEntry(recordServiceId, [{ op: 'add', path: '/entry', value: { marker: 'set' } }], {
        runtimeId: 'peer',
        counter: 1,
      })
    );

    expect(service.queries.recordFields.get({ entryId: 'entry' })).toEqual({ marker: 'set' });
  });

  it('drops a duplicate stamp arriving after it was applied', () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    const payload = peerEntry(
      recordServiceId,
      [{ op: 'add', path: '/entry', value: { marker: 'new' } }],
      { runtimeId: 'peer', counter: 1 }
    );
    channel.emitExternal(SERVICE_ENTRY, payload);
    channel.emitExternal(
      SERVICE_ENTRY,
      peerEntry(recordServiceId, [{ op: 'add', path: '/entry', value: { marker: 'stale' } }], {
        runtimeId: 'peer',
        counter: 1,
      })
    );

    expect(service.queries.recordFields.get({ entryId: 'entry' })).toEqual({ marker: 'new' });
  });

  it('ignores entries for a different service id', () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    channel.emitExternal(
      SERVICE_ENTRY,
      peerEntry('some-other-service', [{ op: 'add', path: '/entry', value: { x: '1' } }], {
        runtimeId: 'peer',
        counter: 1,
      })
    );

    expect(service.queries.recordFields.get({ entryId: 'entry' })).toBeNull();
  });

  it('drops malformed entries without throwing or mutating state', () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    const malformed: unknown[] = [
      null,
      {},
      { serviceId: recordServiceId, patch: [{ op: 'add', path: '/a', value: { k: 'v' } }] },
      {
        serviceId: recordServiceId,
        stamp: { runtimeId: 'p', counter: 0 },
        command: 'x',
        patch: [{ op: 'add', path: '/a', value: { k: 'v' } }],
      },
    ];

    for (const payload of malformed) {
      expect(() => channel.emitExternal(SERVICE_ENTRY, payload)).not.toThrow();
    }

    expect(service.queries.recordFields.get({ entryId: 'a' })).toBeNull();
  });
});

describe('server: teardown via clearRegistry', () => {
  it('detaches channel listeners so later entries are ignored', () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    channel.emitExternal(
      SERVICE_ENTRY,
      peerEntry(recordServiceId, [{ op: 'add', path: '/entry', value: { marker: 'set' } }], {
        runtimeId: 'peer',
        counter: 1,
      })
    );
    expect(service.queries.recordFields.get({ entryId: 'entry' })).toEqual({ marker: 'set' });

    clearRegistry();

    expect(channel.off).toHaveBeenCalledWith(SERVICE_SYNC_START, expect.any(Function));
    expect(channel.off).toHaveBeenCalledWith(SERVICE_SYNC_START_REPLY, expect.any(Function));
    expect(channel.off).toHaveBeenCalledWith(SERVICE_ENTRY, expect.any(Function));

    channel.emitExternal(
      SERVICE_ENTRY,
      peerEntry(recordServiceId, [{ op: 'add', path: '/entry', value: { marker: 'after' } }], {
        runtimeId: 'peer',
        counter: 2,
      })
    );
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
      runtimeId: 'peer-1',
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
  it('forwards an accepted entry once, preserving the original payload object', () => {
    const channel = createMockChannel();
    installChannel(channel);

    registerService(mutableRecordLookupServiceDef);

    const payload = peerEntry(
      recordServiceId,
      [{ op: 'add', path: '/entry', value: { marker: 'set' } }],
      { runtimeId: 'peer-1', counter: 1 },
      { extra: 'keep-me' }
    );
    channel.emitExternal(SERVICE_ENTRY, payload);

    const relays = entryEmits(channel);
    expect(relays).toHaveLength(1);
    expect(relays[0][1]).toBe(payload);
    expect(relays[0][1]).toEqual(expect.objectContaining({ extra: 'keep-me' }));
  });

  it('relays a bootstrap snapshot it adopts as the original sync-start-reply', () => {
    const channel = createMockChannel();
    installChannel(channel);

    registerService(mutableRecordLookupServiceDef);

    const payload = {
      serviceId: recordServiceId,
      state: { entry: { marker: 'boot' } },
      version: 4,
      runtimeId: 'peer-1',
    };
    channel.emitExternal(SERVICE_SYNC_START_REPLY, payload);

    const relays = channel.emit.mock.calls.filter(([event]) => event === SERVICE_SYNC_START_REPLY);
    expect(relays).toHaveLength(1);
    expect(relays[0][1]).toBe(payload);
  });

  it('does not forward a duplicate entry', () => {
    const channel = createMockChannel();
    installChannel(channel);

    registerService(mutableRecordLookupServiceDef);

    const payload = peerEntry(
      recordServiceId,
      [{ op: 'add', path: '/entry', value: { marker: 'new' } }],
      { runtimeId: 'peer-1', counter: 1 }
    );
    channel.emitExternal(SERVICE_ENTRY, payload);
    channel.emitExternal(
      SERVICE_ENTRY,
      peerEntry(recordServiceId, [{ op: 'add', path: '/entry', value: { marker: 'stale' } }], {
        runtimeId: 'peer-1',
        counter: 1,
      })
    );

    expect(entryEmits(channel)).toHaveLength(1);
  });
});
