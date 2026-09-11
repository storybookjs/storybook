/**
 * Channel sync tests for the default leaf registration path (`relay: false`).
 *
 * Hub (dev-server) behavior lives in {@link ./service-registration-sync.test.ts}.
 * Runtime queries, subscriptions, and registry metadata live in
 * {@link ./service-runtime.test.ts} and {@link ./service-registration.test.ts}.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from 'storybook/internal/client-logger';

import { mutableRecordLookupServiceDef } from './fixtures.ts';
import { SERVICE_ENTRY, SERVICE_SYNC_REPLY, SERVICE_SYNC_REQUEST } from './service-channel.ts';
import { clearRegistry, registerService, unregisterService } from './service-registry.ts';
import { createTestChannel, installTestChannel } from '../../channels/test-channel.ts';

vi.mock('storybook/internal/client-logger', { spy: true });

const createMockChannel = createTestChannel;
const installChannel = installTestChannel;

function peerEntry(
  serviceId: string,
  patch: Array<
    { op: 'add' | 'replace'; path: string; value: unknown } | { op: 'remove'; path: string }
  >,
  stamp: { runtimeId: string; counter: number; seq?: number }
) {
  return {
    serviceId,
    stamp: { seq: stamp.seq ?? stamp.counter, runtimeId: stamp.runtimeId, counter: stamp.counter },
    command: 'assignRecordField',
    patch,
  };
}

function entryEmits(channel: ReturnType<typeof createMockChannel>) {
  return channel.emit.mock.calls.filter(([event]) => event === SERVICE_ENTRY);
}

beforeEach(() => {
  vi.mocked(logger.warn).mockReset();
  vi.mocked(logger.warn).mockImplementation(() => undefined);
});

afterEach(() => {
  clearRegistry();
  installChannel(null);
});

describe('registerService (leaf)', () => {
  it('allows re-registration after unregisterService', () => {
    installChannel(createMockChannel());
    registerService(mutableRecordLookupServiceDef);
    unregisterService(mutableRecordLookupServiceDef.id);

    expect(() => registerService(mutableRecordLookupServiceDef)).not.toThrow();
  });
});

describe('channel: sync-request initialization (leaf)', () => {
  it('adopts a sync-reply from a hub that was not listening at registration time', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const preview = registerService(mutableRecordLookupServiceDef, undefined, {
      relay: false,
    });

    expect(channel.emit).toHaveBeenCalledWith(
      SERVICE_SYNC_REQUEST,
      expect.objectContaining({
        serviceId: mutableRecordLookupServiceDef.id,
        frontier: { vector: {}, clock: 0 },
      })
    );

    channel.emitExternal(SERVICE_SYNC_REPLY, {
      serviceId: mutableRecordLookupServiceDef.id,
      state: { 'entry-late': { marker: 'synced' } },
      frontier: { vector: { 'manager-hub': 1 }, clock: 1 },
    });

    expect(preview.queries.recordFields.get({ entryId: 'entry-late' })).toEqual({
      marker: 'synced',
    });

    expect(channel.emit.mock.calls.filter(([event]) => event === SERVICE_SYNC_REQUEST).length).toBe(
      1
    );
  });

  it('converges via entries when a sync-reply carried empty state', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const preview = registerService(mutableRecordLookupServiceDef, undefined, {
      relay: false,
    });

    channel.emitExternal(SERVICE_SYNC_REPLY, {
      serviceId: mutableRecordLookupServiceDef.id,
      state: {},
      frontier: { vector: {}, clock: 0 },
    });

    channel.emitExternal(
      SERVICE_ENTRY,
      peerEntry(
        mutableRecordLookupServiceDef.id,
        [{ op: 'add', path: '/entry-stale', value: { marker: 'v1' } }],
        {
          runtimeId: 'early-hub',
          counter: 1,
        }
      )
    );

    expect(preview.queries.recordFields.get({ entryId: 'entry-stale' })).toEqual({
      marker: 'v1',
    });
  });
});

describe('channel: entry broadcast (leaf)', () => {
  it('does not re-apply its own entry echo (loop prevention)', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    const received: unknown[] = [];
    service.queries.recordFields.subscribe({ entryId: 'a' }, (v) => received.push(v));
    await vi.waitFor(() => expect(received).toHaveLength(1));

    await service.commands.assignRecordField({ entryId: 'a', fieldKey: 'k', fieldValue: 'v' });
    await vi.waitFor(() => expect(received).toHaveLength(2));

    await new Promise<void>((resolve) => setTimeout(resolve, 20));

    expect(received).toHaveLength(2);
  });
});

describe('channel: entry apply', () => {
  it('keeps writes to different keys from two writers', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    channel.emitExternal(
      SERVICE_ENTRY,
      peerEntry(
        mutableRecordLookupServiceDef.id,
        [{ op: 'add', path: '/red', value: { color: 'red' } }],
        { runtimeId: 'aaa', counter: 1 }
      )
    );
    channel.emitExternal(
      SERVICE_ENTRY,
      peerEntry(
        mutableRecordLookupServiceDef.id,
        [{ op: 'add', path: '/blue', value: { color: 'blue' } }],
        { runtimeId: 'zzz', counter: 1 }
      )
    );

    await vi.waitFor(() => {
      expect(service.queries.recordFields.get({ entryId: 'red' })).toEqual({ color: 'red' });
      expect(service.queries.recordFields.get({ entryId: 'blue' })).toEqual({ color: 'blue' });
    });
  });

  it('applies same-path writes in canonical stamp order, not arrival order', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    channel.emitExternal(
      SERVICE_ENTRY,
      peerEntry(
        mutableRecordLookupServiceDef.id,
        [{ op: 'add', path: '/item', value: { color: 'blue' } }],
        { runtimeId: 'zzz', counter: 1, seq: 1 }
      )
    );
    channel.emitExternal(
      SERVICE_ENTRY,
      peerEntry(
        mutableRecordLookupServiceDef.id,
        [{ op: 'replace', path: '/item', value: { color: 'red' } }],
        { runtimeId: 'aaa', counter: 1, seq: 1 }
      )
    );

    await vi.waitFor(() =>
      expect(service.queries.recordFields.get({ entryId: 'item' })).toEqual({ color: 'blue' })
    );
  });

  it('drops a duplicate stamp after it was applied', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    channel.emitExternal(
      SERVICE_ENTRY,
      peerEntry(
        mutableRecordLookupServiceDef.id,
        [{ op: 'add', path: '/item', value: { color: 'green' } }],
        { runtimeId: 'peer', counter: 1 }
      )
    );
    channel.emitExternal(
      SERVICE_ENTRY,
      peerEntry(
        mutableRecordLookupServiceDef.id,
        [{ op: 'add', path: '/item', value: { color: 'red' } }],
        { runtimeId: 'peer', counter: 1 }
      )
    );

    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    expect(service.queries.recordFields.get({ entryId: 'item' })).toEqual({ color: 'green' });
  });
});

describe('channel: multi-peer sync-reply bootstrap', () => {
  it('installs dominating replies in arrival order', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    channel.emitExternal(SERVICE_SYNC_REPLY, {
      serviceId: mutableRecordLookupServiceDef.id,
      state: { item: { v: '1' } },
      frontier: { vector: { p1: 1 }, clock: 1 },
    });
    channel.emitExternal(SERVICE_SYNC_REPLY, {
      serviceId: mutableRecordLookupServiceDef.id,
      state: { item: { v: '3' } },
      frontier: { vector: { p1: 1, p3: 2 }, clock: 3 },
    });
    channel.emitExternal(SERVICE_SYNC_REPLY, {
      serviceId: mutableRecordLookupServiceDef.id,
      state: { item: { v: '2' } },
      frontier: { vector: { p1: 1, p2: 1 }, clock: 2 },
    });

    await vi.waitFor(() =>
      expect(service.queries.recordFields.get({ entryId: 'item' })).toEqual({ v: '3' })
    );
  });
});

describe('channel: deletion propagation', () => {
  it('deletes keys removed by a later entry', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    channel.emitExternal(
      SERVICE_ENTRY,
      peerEntry(
        mutableRecordLookupServiceDef.id,
        [
          { op: 'add', path: '/a', value: { k: 'v' } },
          { op: 'add', path: '/b', value: { k: 'w' } },
        ],
        { runtimeId: 'peer', counter: 1 }
      )
    );
    await vi.waitFor(() =>
      expect(service.queries.recordFields.get({ entryId: 'b' })).toEqual({ k: 'w' })
    );

    channel.emitExternal(
      SERVICE_ENTRY,
      peerEntry(mutableRecordLookupServiceDef.id, [{ op: 'remove', path: '/b' }], {
        runtimeId: 'peer',
        counter: 2,
      })
    );

    await vi.waitFor(() => expect(service.queries.recordFields.get({ entryId: 'b' })).toBeNull());
    expect(service.queries.recordFields.get({ entryId: 'a' })).toEqual({ k: 'v' });
  });
});

describe('channel: untrusted payloads', () => {
  it('rejects a hostile pointer path without mutating state', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    expect(() =>
      channel.emitExternal(SERVICE_ENTRY, {
        serviceId: mutableRecordLookupServiceDef.id,
        stamp: { seq: 1, runtimeId: 'attacker', counter: 1 },
        command: 'assignRecordField',
        patch: [
          { op: 'add', path: '/good', value: { k: 'v' } },
          { op: 'add', path: '/__proto__/polluted', value: 'yes' },
        ],
      })
    ).not.toThrow();

    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    expect(service.queries.recordFields.get({ entryId: 'good' })).toBeNull();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('drops malformed sync-reply and entry payloads without mutating state', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    const malformed: unknown[] = [
      null,
      {},
      { serviceId: mutableRecordLookupServiceDef.id, state: { a: { k: 'v' } }, runtimeId: 'p' },
      {
        serviceId: mutableRecordLookupServiceDef.id,
        state: 'not-an-object',
        version: 1,
        runtimeId: 'p',
      },
    ];

    for (const payload of malformed) {
      expect(() => channel.emitExternal(SERVICE_ENTRY, payload)).not.toThrow();
      expect(() => channel.emitExternal(SERVICE_SYNC_REPLY, payload)).not.toThrow();
    }

    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    expect(service.queries.recordFields.get({ entryId: 'a' })).toBeNull();
  });
});

describe('channel: relay role (leaf)', () => {
  it('adopts a peer entry but never re-broadcasts it', () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    channel.emitExternal(
      SERVICE_ENTRY,
      peerEntry(
        mutableRecordLookupServiceDef.id,
        [{ op: 'add', path: '/item', value: { color: 'red' } }],
        { runtimeId: 'peer-1', counter: 1 }
      )
    );

    expect(service.queries.recordFields.get({ entryId: 'item' })).toEqual({ color: 'red' });
    expect(entryEmits(channel)).toHaveLength(0);
  });
});

describe('channel: disconnect on unregister', () => {
  it('detaches listeners and ignores later peer entries', async () => {
    const channel = createMockChannel();
    installChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    channel.emitExternal(
      SERVICE_ENTRY,
      peerEntry(
        mutableRecordLookupServiceDef.id,
        [{ op: 'add', path: '/entry', value: { marker: 'before' } }],
        { runtimeId: 'peer', counter: 1 }
      )
    );
    await vi.waitFor(() =>
      expect(service.queries.recordFields.get({ entryId: 'entry' })).toEqual({
        marker: 'before',
      })
    );

    unregisterService(mutableRecordLookupServiceDef.id);

    expect(channel.off).toHaveBeenCalledWith(SERVICE_SYNC_REQUEST, expect.any(Function));
    expect(channel.off).toHaveBeenCalledWith(SERVICE_SYNC_REPLY, expect.any(Function));
    expect(channel.off).toHaveBeenCalledWith(SERVICE_ENTRY, expect.any(Function));

    channel.emitExternal(
      SERVICE_ENTRY,
      peerEntry(
        mutableRecordLookupServiceDef.id,
        [{ op: 'add', path: '/entry', value: { marker: 'after' } }],
        { runtimeId: 'peer', counter: 2 }
      )
    );

    expect(service.queries.recordFields.get({ entryId: 'entry' })).toEqual({ marker: 'before' });
  });
});
