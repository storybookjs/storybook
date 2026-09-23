import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as v from 'valibot';
import { logger } from 'storybook/internal/client-logger';

import { OpenServiceMissingChannelError } from '../../server-errors.ts';
import { createTestChannel, installTestChannel } from '../../channels/test-channel.ts';
import {
  awaitedPreloadValueServiceDef,
  entryEmits,
  mutableRecordLookupServiceDef,
  noInputSchema,
  peerEntry,
  voidOutputSchema,
} from './fixtures.ts';
import { defineService } from './service-definition.ts';
import { SERVICE_ENTRY, SERVICE_SYNC_REPLY, SERVICE_SYNC_REQUEST } from './service-channel.ts';
import { clearRegistry, registerService } from './server.ts';

vi.mock('storybook/internal/client-logger', { spy: true });

const { id: recordServiceId } = mutableRecordLookupServiceDef;

type RecorderBroadcastState = { a: number; b: number; n: number; count: number };

const gate = {
  opened: Promise.resolve() as Promise<void>,
  open: () => {},
  reached: () => {},
};

function armGate(): Promise<void> {
  gate.opened = new Promise<void>((resolve) => {
    gate.open = resolve;
  });
  return new Promise<void>((resolve) => {
    gate.reached = resolve;
  });
}

const recorderBroadcastServiceDef = defineService({
  id: 'internal-fixture/recorder-broadcast',
  description: 'Exercises per-setState entry authoring.',
  initialState: { a: 0, b: 0, n: 0, count: 0 } satisfies RecorderBroadcastState,
  queries: {
    snapshot: {
      description: 'Returns the full state.',
      input: noInputSchema,
      output: v.object({ a: v.number(), b: v.number(), n: v.number(), count: v.number() }),
      handler: (_input, ctx) => ({
        a: ctx.self.state.a,
        b: ctx.self.state.b,
        n: ctx.self.state.n,
        count: ctx.self.state.count,
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
    writeAThenThrow: {
      description: 'Writes a, awaits, then throws before writing b.',
      input: noInputSchema,
      output: voidOutputSchema,
      handler: async (_input, ctx) => {
        ctx.self.setState((state) => {
          state.a = 1;
        });
        await Promise.resolve();
        throw new Error('boom');
      },
    },
    countOneThenZero: {
      description: 'Writes count to 1, waits for the gate, then writes count to 0.',
      input: noInputSchema,
      output: voidOutputSchema,
      handler: async (_input, ctx) => {
        ctx.self.setState((state) => {
          state.count = 1;
        });
        gate.reached();
        await gate.opened;
        ctx.self.setState((state) => {
          state.count = 0;
        });
      },
    },
    countTwo: {
      description: 'Writes count to 2.',
      input: noInputSchema,
      output: voidOutputSchema,
      handler: (_input, ctx) => {
        ctx.self.setState((state) => {
          state.count = 2;
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
  vi.useRealTimers();
});

// The repair paths warn; nothing here asserts on them, so keep them out of the test output.
beforeEach(() => {
  vi.mocked(logger.warn).mockReset();
  vi.mocked(logger.debug).mockReset();
  vi.mocked(logger.warn).mockImplementation(() => undefined);
  vi.mocked(logger.debug).mockImplementation(() => undefined);
});

// These tests exercise the server transport that `registerService` wires when a channel is present
// BEFORE registration — the dev server installs it in its `services` preset, so there is no separate
// connect step. The server is always a relay hub: one dev server bridges every connected manager tab.

describe('registerService: channel wiring', () => {
  it('wires the installed channel listeners on registration', () => {
    const channel = createMockChannel();
    installChannel(channel);

    registerService(mutableRecordLookupServiceDef);

    expect(channel.on).toHaveBeenCalledWith(SERVICE_SYNC_REQUEST, expect.any(Function));
    expect(channel.on).toHaveBeenCalledWith(SERVICE_SYNC_REPLY, expect.any(Function));
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
  it('emits a services:entry for a local write', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    await service.commands.assignRecordField({ entryId: 'a', fieldKey: 'k', fieldValue: 'v' });

    const entries = entryEmits(channel);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      serviceId: recordServiceId,
      command: 'assignRecordField',
      stamp: { seq: 1, runtimeId: expect.any(String), counter: 1 },
      patch: [{ op: 'add', path: '/a', value: { k: 'v' } }],
    });
    expect(service.queries.recordFields.get({ entryId: 'a' })).toEqual({ k: 'v' });
  });

  it('advances the counter on each write, keeping a stable runtimeId', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    await service.commands.assignRecordField({ entryId: 'a', fieldKey: 'k', fieldValue: '1' });
    await service.commands.assignRecordField({ entryId: 'a', fieldKey: 'k', fieldValue: '2' });

    const entries = entryEmits(channel);
    expect(entries.map((entry) => entry.stamp.counter)).toEqual([1, 2]);
    expect(entries[1].stamp.runtimeId).toBe(entries[0].stamp.runtimeId);
    expect(service.queries.recordFields.get({ entryId: 'a' })).toEqual({ k: '2' });
  });

  it('emits no sync frame and does not bump the stamp for a setState that writes nothing', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(recorderBroadcastServiceDef);

    await service.commands.noop();
    await service.commands.sameN();

    expect(entryEmits(channel)).toHaveLength(0);

    await service.commands.setA();

    const entries = entryEmits(channel);
    expect(entries).toHaveLength(1);
    expect(entries[0].stamp.counter).toBe(1);
    expect(service.queries.snapshot.get()).toEqual({ a: 1, b: 0, n: 0, count: 0 });
  });

  it('emits one entry per setState, tagged with the command that ran it', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(recorderBroadcastServiceDef);

    await service.commands.outer();

    const entries = entryEmits(channel);
    expect(entries.map((entry) => entry.stamp.counter)).toEqual([1, 2]);
    expect(entries.map((entry) => [entry.command, entry.patch])).toEqual([
      ['outer', [{ op: 'replace', path: '/a', value: 1 }]],
      ['setB', [{ op: 'replace', path: '/b', value: 2 }]],
    ]);
    expect(service.queries.snapshot.get()).toEqual({ a: 1, b: 2, n: 0, count: 0 });
  });

  it('has already emitted the writes made before a command throws', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(recorderBroadcastServiceDef);

    await expect(service.commands.writeAThenThrow()).rejects.toThrow('boom');

    const entries = entryEmits(channel);
    expect(entries.map((entry) => entry.patch)).toEqual([
      [{ op: 'replace', path: '/a', value: 1 }],
    ]);
    expect(service.queries.snapshot.get()).toEqual({ a: 1, b: 0, n: 0, count: 0 });
  });

  it('keeps peers and the author equal when two commands interleave around an await', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(recorderBroadcastServiceDef);

    const reached = armGate();
    const slow = service.commands.countOneThenZero();
    await reached;
    await service.commands.countTwo();
    gate.open();
    await slow;

    const entries = entryEmits(channel);
    expect(entries.map((entry) => entry.patch)).toEqual([
      [{ op: 'replace', path: '/count', value: 1 }],
      [{ op: 'replace', path: '/count', value: 2 }],
      [{ op: 'replace', path: '/count', value: 0 }],
    ]);
    expect(service.queries.snapshot.get().count).toBe(0);
  });

  it('emits a frame for a write made by a command inside a reactive load', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(awaitedPreloadValueServiceDef);
    const unsubscribe = service.queries.preloadedValue.subscribe({ entryId: 'entry-a' }, () => {});

    await vi.waitFor(() =>
      expect(channel.emit).toHaveBeenCalledWith(
        SERVICE_ENTRY,
        expect.objectContaining({
          command: 'preloadValue',
          patch: [{ op: 'add', path: '/entry-a', value: 'preloaded' }],
        })
      )
    );
    unsubscribe();
  });
});

describe('server: sync-request initialization', () => {
  it('replies to a sync-request only when its vector dominates', () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    channel.emitExternal(
      SERVICE_ENTRY,
      peerEntry(recordServiceId, [{ op: 'add', path: '/a', value: { k: 'v' } }], {
        runtimeId: 'peer-1',
        counter: 1,
      })
    );
    expect(service.queries.recordFields.get({ entryId: 'a' })).toEqual({ k: 'v' });

    channel.emitExternal(SERVICE_SYNC_REQUEST, {
      serviceId: recordServiceId,
      runtimeId: 'peer-2',
      frontier: { vector: {}, clock: 0 },
    });

    expect(channel.emit).toHaveBeenCalledWith(
      SERVICE_SYNC_REPLY,
      expect.objectContaining({
        serviceId: recordServiceId,
        state: expect.objectContaining({ a: { k: 'v' } }),
        frontier: expect.objectContaining({ vector: { 'peer-1': 1 } }),
      })
    );
  });

  it('stays silent when its vector does not dominate the requester', () => {
    const channel = createMockChannel();
    installChannel(channel);

    registerService(mutableRecordLookupServiceDef);

    channel.emit.mockClear();
    channel.emitExternal(SERVICE_SYNC_REQUEST, {
      serviceId: recordServiceId,
      runtimeId: 'peer-2',
      frontier: { vector: { ahead: 4 }, clock: 4 },
    });

    expect(channel.emit.mock.calls.filter(([event]) => event === SERVICE_SYNC_REPLY)).toHaveLength(
      0
    );
  });

  it('does not reply to a sync-request for a different service id', () => {
    const channel = createMockChannel();
    installChannel(channel);

    registerService(mutableRecordLookupServiceDef);

    channel.emitExternal(SERVICE_SYNC_REQUEST, {
      serviceId: 'some-other-service',
      runtimeId: 'peer-2',
      frontier: { vector: {}, clock: 0 },
    });

    const replyCalls = channel.emit.mock.calls.filter(([event]) => event === SERVICE_SYNC_REPLY);
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

    channel.emitExternal(
      SERVICE_ENTRY,
      peerEntry(recordServiceId, [{ op: 'add', path: '/entry', value: { marker: 'new' } }], {
        runtimeId: 'peer',
        counter: 1,
      })
    );
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

    expect(channel.off).toHaveBeenCalledWith(SERVICE_SYNC_REQUEST, expect.any(Function));
    expect(channel.off).toHaveBeenCalledWith(SERVICE_SYNC_REPLY, expect.any(Function));
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
  it('emits a sync-request so a freshly-registered server can catch up', () => {
    const channel = createMockChannel();
    installChannel(channel);

    registerService(mutableRecordLookupServiceDef);

    expect(channel.emit).toHaveBeenCalledWith(
      SERVICE_SYNC_REQUEST,
      expect.objectContaining({
        serviceId: recordServiceId,
        frontier: { vector: {}, clock: 0 },
      })
    );
  });

  it('adopts state from a dominating sync-reply (a late/restarted server catches up)', () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    channel.emitExternal(SERVICE_SYNC_REPLY, {
      serviceId: recordServiceId,
      runtimeId: 'peer',
      state: { a: { k: 'v' } },
      frontier: { vector: { 'peer-1': 3 }, clock: 3 },
    });

    expect(service.queries.recordFields.get({ entryId: 'a' })).toEqual({ k: 'v' });
  });

  it('does not treat its own sync-request echo as incoming state', () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    expect(service.queries.recordFields.get({ entryId: 'a' })).toBeNull();
    const replyCalls = channel.emit.mock.calls.filter(([event]) => event === SERVICE_SYNC_REPLY);
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
    expect(relays[0]).toBe(payload);
  });

  it('relays a bootstrap snapshot it installs as the original sync-reply', () => {
    const channel = createMockChannel();
    installChannel(channel);

    registerService(mutableRecordLookupServiceDef);

    const payload = {
      serviceId: recordServiceId,
      runtimeId: 'peer-1',
      state: { entry: { marker: 'boot' } },
      frontier: { vector: { 'peer-1': 4 }, clock: 4 },
    };
    channel.emitExternal(SERVICE_SYNC_REPLY, payload);

    const relays = channel.emit.mock.calls.filter(([event]) => event === SERVICE_SYNC_REPLY);
    expect(relays).toHaveLength(1);
    expect(relays[0][1]).toBe(payload);
  });

  it('does not forward a rejected sync-reply', () => {
    const channel = createMockChannel();
    installChannel(channel);

    registerService(mutableRecordLookupServiceDef);
    channel.emitExternal(
      SERVICE_ENTRY,
      peerEntry(recordServiceId, [{ op: 'add', path: '/entry', value: { marker: 'local' } }], {
        runtimeId: 'aaa',
        counter: 1,
      })
    );
    channel.emit.mockClear();

    channel.emitExternal(SERVICE_SYNC_REPLY, {
      serviceId: recordServiceId,
      runtimeId: 'peer',
      state: { other: { marker: 'concurrent' } },
      frontier: { vector: { zzz: 1 }, clock: 1 },
    });

    expect(channel.emit.mock.calls.filter(([event]) => event === SERVICE_SYNC_REPLY)).toHaveLength(
      0
    );
  });

  it('does not forward a sync-request', () => {
    const channel = createMockChannel();
    installChannel(channel);

    registerService(mutableRecordLookupServiceDef);
    channel.emitExternal(
      SERVICE_ENTRY,
      peerEntry(recordServiceId, [{ op: 'add', path: '/entry', value: { marker: 'set' } }], {
        runtimeId: 'peer-1',
        counter: 1,
      })
    );
    channel.emit.mockClear();

    const payload = {
      serviceId: recordServiceId,
      runtimeId: 'peer-2',
      frontier: { vector: {}, clock: 0 },
    };
    channel.emitExternal(SERVICE_SYNC_REQUEST, payload);

    expect(
      channel.emit.mock.calls.filter(([event]) => event === SERVICE_SYNC_REQUEST)
    ).toHaveLength(0);
    expect(channel.emit.mock.calls.filter(([event]) => event === SERVICE_SYNC_REPLY)).toHaveLength(
      1
    );
  });

  it('does not forward a duplicate entry', () => {
    const channel = createMockChannel();
    installChannel(channel);

    registerService(mutableRecordLookupServiceDef);

    channel.emitExternal(
      SERVICE_ENTRY,
      peerEntry(recordServiceId, [{ op: 'add', path: '/entry', value: { marker: 'new' } }], {
        runtimeId: 'peer-1',
        counter: 1,
      })
    );
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

describe('server: repair requests', () => {
  function clearBootstrapRequest(channel: ReturnType<typeof createMockChannel>) {
    channel.emitExternal(SERVICE_SYNC_REPLY, {
      serviceId: recordServiceId,
      runtimeId: 'peer',
      frontier: { vector: {}, clock: 0 },
      state: {},
    });
    channel.emit.mockClear();
  }

  it('sends one sync-request on a gap and does not send a second while outstanding', () => {
    const channel = createMockChannel();
    installChannel(channel);

    registerService(mutableRecordLookupServiceDef);
    clearBootstrapRequest(channel);

    channel.emitExternal(
      SERVICE_ENTRY,
      peerEntry(recordServiceId, [{ op: 'add', path: '/a', value: { k: '1' } }], {
        runtimeId: 'peer',
        counter: 2,
        seq: 2,
      })
    );
    channel.emitExternal(
      SERVICE_ENTRY,
      peerEntry(recordServiceId, [{ op: 'add', path: '/b', value: { k: '2' } }], {
        runtimeId: 'peer',
        counter: 3,
        seq: 3,
      })
    );

    expect(
      channel.emit.mock.calls.filter(([event]) => event === SERVICE_SYNC_REQUEST)
    ).toHaveLength(1);
  });

  it('keeps a missing parent as a no-op and sends a sync-request', () => {
    const channel = createMockChannel();
    installChannel(channel);

    registerService(mutableRecordLookupServiceDef);
    clearBootstrapRequest(channel);

    channel.emitExternal(
      SERVICE_ENTRY,
      peerEntry(recordServiceId, [{ op: 'add', path: '/missing/y', value: 3 }], {
        runtimeId: 'peer',
        counter: 1,
      })
    );

    expect(
      channel.emit.mock.calls.filter(([event]) => event === SERVICE_SYNC_REQUEST)
    ).toHaveLength(1);
  });

  it('clears the outstanding request after 1 s of silence so a later gap can ask again', () => {
    vi.useFakeTimers();
    const channel = createMockChannel();
    installChannel(channel);

    registerService(mutableRecordLookupServiceDef);
    vi.advanceTimersByTime(1000);
    channel.emit.mockClear();

    channel.emitExternal(
      SERVICE_ENTRY,
      peerEntry(recordServiceId, [{ op: 'add', path: '/a', value: { k: '1' } }], {
        runtimeId: 'peer',
        counter: 2,
        seq: 2,
      })
    );
    expect(
      channel.emit.mock.calls.filter(([event]) => event === SERVICE_SYNC_REQUEST)
    ).toHaveLength(1);

    channel.emitExternal(
      SERVICE_ENTRY,
      peerEntry(recordServiceId, [{ op: 'add', path: '/b', value: { k: '2' } }], {
        runtimeId: 'peer',
        counter: 3,
        seq: 3,
      })
    );
    expect(
      channel.emit.mock.calls.filter(([event]) => event === SERVICE_SYNC_REQUEST)
    ).toHaveLength(1);

    vi.advanceTimersByTime(1000);
    expect(
      channel.emit.mock.calls.filter(([event]) => event === SERVICE_SYNC_REQUEST)
    ).toHaveLength(2);

    vi.advanceTimersByTime(1000);
    channel.emit.mockClear();

    channel.emitExternal(
      SERVICE_ENTRY,
      peerEntry(recordServiceId, [{ op: 'add', path: '/c', value: { k: '3' } }], {
        runtimeId: 'peer',
        counter: 5,
        seq: 5,
      })
    );
    expect(
      channel.emit.mock.calls.filter(([event]) => event === SERVICE_SYNC_REQUEST)
    ).toHaveLength(1);
  });
});
