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
import { unregisterService, registerService as registerLeaf } from './service-registry.ts';
import { clearRegistry, registerService as registerHub } from './server.ts';

vi.mock('storybook/internal/client-logger', { spy: true });

const { id: recordServiceId } = mutableRecordLookupServiceDef;

type RecorderBroadcastState = { a: number; n: number; count: number };

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
  initialState: { a: 0, n: 0, count: 0 } satisfies RecorderBroadcastState,
  queries: {
    snapshot: {
      description: 'Returns the full state.',
      input: noInputSchema,
      output: v.object({ a: v.number(), n: v.number(), count: v.number() }),
      handler: (_input, ctx) => ({
        a: ctx.self.state.a,
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
});

// The repair paths warn; nothing here asserts on them, so keep them out of the test output.
beforeEach(() => {
  vi.mocked(logger.warn).mockReset();
  vi.mocked(logger.debug).mockReset();
  vi.mocked(logger.warn).mockImplementation(() => undefined);
  vi.mocked(logger.debug).mockImplementation(() => undefined);
});

describe('registerService: channel wiring', () => {
  it('throws when the addons channel is not installed', () => {
    installChannel(null);

    expect(() => registerHub(mutableRecordLookupServiceDef)).toThrow(
      OpenServiceMissingChannelError
    );
  });
});

describe('registerService: authored entries', () => {
  it('emits a services:entry for a local write', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerHub(mutableRecordLookupServiceDef);

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

  it('emits no sync frame and does not bump the stamp for a setState that writes nothing', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerHub(recorderBroadcastServiceDef);

    await service.commands.noop();
    await service.commands.sameN();

    expect(entryEmits(channel)).toHaveLength(0);

    await service.commands.setA();

    const entries = entryEmits(channel);
    expect(entries).toHaveLength(1);
    expect(entries[0].stamp.counter).toBe(1);
    expect(service.queries.snapshot.get()).toEqual({ a: 1, n: 0, count: 0 });
  });

  it('keeps peers and the author equal when two commands interleave around an await', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerHub(recorderBroadcastServiceDef);

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

    const service = registerHub(awaitedPreloadValueServiceDef);
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

describe('registerService: peer traffic', () => {
  it('stays silent when its vector does not dominate the requester', () => {
    const channel = createMockChannel();
    installChannel(channel);

    registerHub(mutableRecordLookupServiceDef);

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

  it('ignores a sync-request and a sync-reply for a different service id', () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerHub(mutableRecordLookupServiceDef);
    channel.emitExternal(
      SERVICE_ENTRY,
      peerEntry(recordServiceId, [{ op: 'add', path: '/a', value: { k: 'v' } }], {
        runtimeId: 'peer-1',
        counter: 1,
      })
    );
    channel.emit.mockClear();

    channel.emitExternal(SERVICE_SYNC_REQUEST, {
      serviceId: 'some-other-service',
      runtimeId: 'peer-2',
      frontier: { vector: {}, clock: 0 },
    });
    channel.emitExternal(SERVICE_SYNC_REPLY, {
      serviceId: 'some-other-service',
      runtimeId: 'peer-2',
      state: { b: { k: 'w' } },
      frontier: { vector: { 'peer-1': 1, 'peer-2': 1 }, clock: 2 },
    });

    expect(channel.emit.mock.calls.filter(([event]) => event === SERVICE_SYNC_REPLY)).toHaveLength(
      0
    );
    expect(service.queries.recordFields.get({ entryId: 'b' })).toBeNull();
  });

  it('ignores entries for a different service id', () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerHub(mutableRecordLookupServiceDef);

    channel.emitExternal(
      SERVICE_ENTRY,
      peerEntry('some-other-service', [{ op: 'add', path: '/entry', value: { x: '1' } }], {
        runtimeId: 'peer',
        counter: 1,
      })
    );

    expect(service.queries.recordFields.get({ entryId: 'entry' })).toBeNull();
  });

  it('drops a whole entry that carries a hostile pointer path', () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerHub(mutableRecordLookupServiceDef);

    expect(() =>
      channel.emitExternal(SERVICE_ENTRY, {
        serviceId: recordServiceId,
        stamp: { seq: 1, runtimeId: 'attacker', counter: 1 },
        command: 'assignRecordField',
        patch: [
          { op: 'add', path: '/good', value: { k: 'v' } },
          { op: 'add', path: '/__proto__/polluted', value: 'yes' },
        ],
      })
    ).not.toThrow();

    expect(service.queries.recordFields.get({ entryId: 'good' })).toBeNull();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('drops malformed entries and sync-replies without throwing or mutating state', () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerHub(mutableRecordLookupServiceDef);

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
      { serviceId: recordServiceId, runtimeId: 'p', state: { a: { k: 'v' } } },
      {
        serviceId: recordServiceId,
        runtimeId: 'p',
        state: 'not-an-object',
        frontier: { vector: { p: 1 }, clock: 1 },
      },
    ];

    for (const payload of malformed) {
      expect(() => channel.emitExternal(SERVICE_ENTRY, payload)).not.toThrow();
      expect(() => channel.emitExternal(SERVICE_SYNC_REPLY, payload)).not.toThrow();
    }

    expect(service.queries.recordFields.get({ entryId: 'a' })).toBeNull();
  });
});

describe('registerService: relay role', () => {
  it('forwards an accepted entry once from a hub, preserving the original payload object', () => {
    const channel = createMockChannel();
    installChannel(channel);

    registerHub(mutableRecordLookupServiceDef);

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

  it('places a peer entry on a leaf but never forwards it', () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerLeaf(mutableRecordLookupServiceDef);

    channel.emitExternal(
      SERVICE_ENTRY,
      peerEntry(recordServiceId, [{ op: 'add', path: '/item', value: { color: 'red' } }], {
        runtimeId: 'peer-1',
        counter: 1,
      })
    );

    expect(service.queries.recordFields.get({ entryId: 'item' })).toEqual({ color: 'red' });
    expect(entryEmits(channel)).toHaveLength(0);
  });

  it('does not forward a rejected sync-reply', () => {
    const channel = createMockChannel();
    installChannel(channel);

    registerHub(mutableRecordLookupServiceDef);
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

    registerHub(mutableRecordLookupServiceDef);
    channel.emitExternal(
      SERVICE_ENTRY,
      peerEntry(recordServiceId, [{ op: 'add', path: '/entry', value: { marker: 'set' } }], {
        runtimeId: 'peer-1',
        counter: 1,
      })
    );
    channel.emit.mockClear();

    channel.emitExternal(SERVICE_SYNC_REQUEST, {
      serviceId: recordServiceId,
      runtimeId: 'peer-2',
      frontier: { vector: {}, clock: 0 },
    });

    expect(
      channel.emit.mock.calls.filter(([event]) => event === SERVICE_SYNC_REQUEST)
    ).toHaveLength(0);
    expect(channel.emit.mock.calls.filter(([event]) => event === SERVICE_SYNC_REPLY)).toHaveLength(
      1
    );
  });
});

describe('registerService: teardown', () => {
  it('detaches channel listeners on clearRegistry so later entries are ignored', () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerHub(mutableRecordLookupServiceDef);

    channel.emitExternal(
      SERVICE_ENTRY,
      peerEntry(recordServiceId, [{ op: 'add', path: '/entry', value: { marker: 'set' } }], {
        runtimeId: 'peer',
        counter: 1,
      })
    );
    expect(service.queries.recordFields.get({ entryId: 'entry' })).toEqual({ marker: 'set' });

    clearRegistry();

    channel.emitExternal(
      SERVICE_ENTRY,
      peerEntry(recordServiceId, [{ op: 'add', path: '/entry', value: { marker: 'after' } }], {
        runtimeId: 'peer',
        counter: 2,
      })
    );
    expect(service.queries.recordFields.get({ entryId: 'entry' })).toEqual({ marker: 'set' });
  });

  it('detaches channel listeners on unregisterService and allows a fresh registration', () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerLeaf(mutableRecordLookupServiceDef);
    unregisterService(recordServiceId);

    channel.emitExternal(
      SERVICE_ENTRY,
      peerEntry(recordServiceId, [{ op: 'add', path: '/entry', value: { marker: 'after' } }], {
        runtimeId: 'peer',
        counter: 1,
      })
    );
    expect(service.queries.recordFields.get({ entryId: 'entry' })).toBeNull();

    const fresh = registerLeaf(mutableRecordLookupServiceDef);
    expect(fresh).not.toBe(service);
  });
});
