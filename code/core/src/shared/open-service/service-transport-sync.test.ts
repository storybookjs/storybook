import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from 'storybook/internal/client-logger';

import { createTestChannel } from '../../channels/test-channel.ts';
import {
  SERVICE_ENTRY,
  SERVICE_SYNC_REPLY,
  SERVICE_SYNC_REQUEST,
  type EntryPayload,
} from './service-channel.ts';
import { createReconciler, formatFrontier, type LogWindow } from './service-sync.ts';
import { connectRuntimeToChannel } from './service-transport.ts';

vi.mock('storybook/internal/client-logger', { spy: true });

const SERVICE_ID = 'internal-fixture/transport-sync';

function entry(runtimeId: string, counter: number, path: string, seq = counter): EntryPayload {
  return {
    serviceId: SERVICE_ID,
    stamp: { seq, runtimeId, counter },
    command: 'set',
    patch: [{ op: 'add', path, value: seq }],
  };
}

describe('connectRuntimeToChannel request policy', () => {
  const disconnects: Array<() => void> = [];

  function connect(
    options: { relay?: boolean; window?: Partial<LogWindow>; afterApply?: () => void } = {}
  ) {
    const channel = createTestChannel();
    const state: Record<string, unknown> = {};
    const reconciler = createReconciler({
      serviceId: SERVICE_ID,
      setState: (mutate) => {
        mutate(state);
        options.afterApply?.();
      },
      window: options.window,
    });
    disconnects.push(
      connectRuntimeToChannel({
        serviceId: SERVICE_ID,
        ownRuntimeId: 'self',
        reconciler,
        getSnapshot: () => ({ ...state }),
        channel,
        relay: options.relay ?? false,
      })
    );
    const emitted = (event: string) =>
      channel.emit.mock.calls.filter(([name]) => name === event).map(([, payload]) => payload);
    return { channel, state, reconciler, emitted };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(logger.warn).mockReset();
    vi.mocked(logger.warn).mockImplementation(() => undefined);
  });

  afterEach(() => {
    for (const disconnect of disconnects.splice(0)) {
      disconnect();
    }
    vi.useRealTimers();
  });

  it('sends a sync-request for a beyond-window entry', () => {
    const { channel, emitted } = connect({ window: { maxAgeMs: 0, maxEntries: 2 } });
    vi.advanceTimersByTime(1000);
    for (const counter of [1, 2, 3]) {
      channel.emitExternal(SERVICE_ENTRY, entry('w', counter, `/w${counter}`));
    }
    channel.emit.mockClear();

    channel.emitExternal(SERVICE_ENTRY, entry('other', 1, '/z'));

    expect(emitted(SERVICE_SYNC_REQUEST)).toHaveLength(1);
  });

  it('requests a snapshot for an entry kept as an unapplied no-op', () => {
    const { channel, emitted } = connect();
    vi.advanceTimersByTime(1000);
    channel.emit.mockClear();

    channel.emitExternal(SERVICE_ENTRY, entry('w', 1, '/missing/y'));

    expect(emitted(SERVICE_SYNC_REQUEST)).toHaveLength(1);
  });

  it('keeps one request outstanding, queues the next repair, and sends it after 1 s of silence', () => {
    const { channel, reconciler, emitted } = connect();
    vi.advanceTimersByTime(1000);
    channel.emit.mockClear();

    channel.emitExternal(SERVICE_ENTRY, entry('w', 2, '/a'));
    expect(emitted(SERVICE_SYNC_REQUEST)).toHaveLength(1);

    channel.emitExternal(SERVICE_ENTRY, entry('w', 3, '/b'));
    expect(emitted(SERVICE_SYNC_REQUEST)).toHaveLength(1);

    vi.advanceTimersByTime(1000);
    expect(emitted(SERVICE_SYNC_REQUEST)).toEqual([
      expect.anything(),
      { serviceId: SERVICE_ID, runtimeId: 'self', frontier: { vector: {}, clock: 3 } },
    ]);
    expect(reconciler.frontier).toEqual({ vector: {}, clock: 3 });

    vi.advanceTimersByTime(1000);
    channel.emit.mockClear();
    channel.emitExternal(SERVICE_ENTRY, entry('w', 5, '/c'));
    expect(emitted(SERVICE_SYNC_REQUEST)).toHaveLength(1);
  });

  it('sends a queued repair after an installed reply', () => {
    const { channel, state, reconciler, emitted } = connect();
    channel.emit.mockClear();

    channel.emitExternal(SERVICE_ENTRY, entry('w', 2, '/a'));
    expect(emitted(SERVICE_SYNC_REQUEST)).toHaveLength(0);

    channel.emitExternal(SERVICE_SYNC_REPLY, {
      serviceId: SERVICE_ID,
      runtimeId: 'peer',
      frontier: { vector: { w: 2 }, clock: 2 },
      state: { a: 2 },
    });

    expect(emitted(SERVICE_SYNC_REQUEST)).toEqual([
      { serviceId: SERVICE_ID, runtimeId: 'self', frontier: reconciler.frontier },
    ]);
    expect(state).toEqual({ a: 2 });
  });

  it('warns about a concurrent reply inside its own reply window and ignores one outside it', () => {
    const { channel, state, reconciler } = connect();
    channel.emitExternal(SERVICE_ENTRY, entry('mine', 1, '/a'));
    const local = reconciler.frontier;
    const reply = { vector: { theirs: 1 }, clock: 1 };

    channel.emitExternal(SERVICE_SYNC_REPLY, {
      serviceId: SERVICE_ID,
      runtimeId: 'peer',
      frontier: reply,
      state: { b: 2 },
    });
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      `Open-service sync: concurrent snapshot reply dropped. service=${SERVICE_ID} local=${formatFrontier(local)} reply=${formatFrontier(reply)}`
    );
    expect(state).toEqual({ a: 1 });

    vi.mocked(logger.warn).mockClear();
    vi.advanceTimersByTime(1000);
    channel.emitExternal(SERVICE_SYNC_REPLY, {
      serviceId: SERVICE_ID,
      runtimeId: 'peer',
      frontier: reply,
      state: { b: 2 },
    });
    expect(vi.mocked(logger.warn)).not.toHaveBeenCalled();
  });

  it('re-emits a queued repair when a concurrent reply is dropped', () => {
    const { channel, reconciler, emitted } = connect();
    channel.emitExternal(SERVICE_ENTRY, entry('mine', 1, '/n'));
    channel.emit.mockClear();

    channel.emitExternal(SERVICE_SYNC_REPLY, {
      serviceId: SERVICE_ID,
      runtimeId: 'peer',
      frontier: { vector: { other: 1 }, clock: 1 },
      state: { n: 99 },
    });

    expect(emitted(SERVICE_SYNC_REQUEST)).toEqual([
      { serviceId: SERVICE_ID, runtimeId: 'self', frontier: reconciler.frontier },
    ]);
  });

  it('ignores its own sync-request, even one sent from a frontier it has since passed', () => {
    const { channel, emitted } = connect();
    channel.emitExternal(SERVICE_ENTRY, entry('w', 1, '/a'));
    channel.emit.mockClear();

    channel.emitExternal(SERVICE_SYNC_REQUEST, {
      serviceId: SERVICE_ID,
      runtimeId: 'self',
      frontier: { vector: {}, clock: 0 },
    });

    expect(emitted(SERVICE_SYNC_REPLY)).toHaveLength(0);
  });

  it('does not let the echo of its own reply clear its outstanding request', () => {
    const { channel, emitted } = connect();
    channel.emitExternal(SERVICE_ENTRY, entry('w', 1, '/a'));
    channel.emitExternal(SERVICE_SYNC_REQUEST, {
      serviceId: SERVICE_ID,
      runtimeId: 'joiner',
      frontier: { vector: {}, clock: 0 },
    });
    expect(emitted(SERVICE_SYNC_REPLY)).toHaveLength(1);
    channel.emit.mockClear();

    channel.emitExternal(SERVICE_ENTRY, entry('w', 3, '/c'));

    expect(emitted(SERVICE_SYNC_REQUEST)).toHaveLength(0);
  });

  it('forwards a beyond-window entry once from a relay hub and never a redelivery', () => {
    const { channel, state, emitted } = connect({ relay: true });
    channel.emitExternal(SERVICE_SYNC_REPLY, {
      serviceId: SERVICE_ID,
      runtimeId: 'peer',
      frontier: { vector: { a: 1 }, clock: 5 },
      state: { x: 'a' },
    });
    channel.emit.mockClear();

    const stale = entry('b', 1, '/x', 4);
    channel.emitExternal(SERVICE_ENTRY, stale);
    channel.emitExternal(SERVICE_ENTRY, stale);

    expect(emitted(SERVICE_ENTRY)).toHaveLength(1);
    expect(emitted(SERVICE_ENTRY)[0]).toBe(stale);
    expect(state).toEqual({ x: 'a' });
  });

  it.each(['in-process echo', 'copy over the websocket'])(
    'keeps the queued repair outstanding when a hub hears the %s of a reply it forwarded',
    (echo) => {
      const { channel, emitted } = connect({ relay: true });
      vi.advanceTimersByTime(1000);
      channel.emitExternal(SERVICE_ENTRY, entry('w', 2, '/a'));
      channel.emitExternal(SERVICE_ENTRY, entry('w', 3, '/b'));
      channel.emit.mockClear();

      const reply = {
        serviceId: SERVICE_ID,
        runtimeId: 'peer',
        frontier: { vector: { w: 1 }, clock: 1 },
        state: {},
      };
      channel.emitExternal(SERVICE_SYNC_REPLY, reply);
      if (echo === 'copy over the websocket') {
        channel.emitExternal(SERVICE_SYNC_REPLY, structuredClone(reply));
      }
      expect(emitted(SERVICE_SYNC_REPLY)).toHaveLength(1);
      expect(emitted(SERVICE_SYNC_REQUEST)).toHaveLength(1);

      channel.emitExternal(SERVICE_ENTRY, entry('w', 5, '/c'));

      expect(emitted(SERVICE_SYNC_REQUEST)).toHaveLength(1);
    }
  );

  it('forwards an entry and asks for repair when a subscriber throws after it was placed', () => {
    let subscriberThrows = false;
    const { channel, emitted } = connect({
      relay: true,
      afterApply: () => {
        if (subscriberThrows) {
          subscriberThrows = false;
          throw new Error('subscriber');
        }
      },
    });
    vi.advanceTimersByTime(1000);
    channel.emit.mockClear();

    subscriberThrows = true;
    const placed = entry('w', 1, '/a');
    expect(() => channel.emitExternal(SERVICE_ENTRY, placed)).toThrow('subscriber');
    channel.emitExternal(SERVICE_ENTRY, placed);

    expect(emitted(SERVICE_ENTRY)).toEqual([placed]);
    expect(emitted(SERVICE_SYNC_REQUEST)).toHaveLength(1);
  });

  it('settles its request and forwards an installed reply when a subscriber throws', () => {
    let subscriberThrows = false;
    const { channel, emitted } = connect({
      relay: true,
      afterApply: () => {
        if (subscriberThrows) {
          subscriberThrows = false;
          throw new Error('subscriber');
        }
      },
    });
    channel.emitExternal(SERVICE_ENTRY, entry('w', 2, '/a'));
    channel.emit.mockClear();

    subscriberThrows = true;
    const reply = {
      serviceId: SERVICE_ID,
      runtimeId: 'peer',
      frontier: { vector: { w: 2 }, clock: 2 },
      state: { a: 2 },
    };
    expect(() => channel.emitExternal(SERVICE_SYNC_REPLY, reply)).toThrow('subscriber');

    expect(emitted(SERVICE_SYNC_REPLY)).toEqual([reply]);
    expect(emitted(SERVICE_SYNC_REQUEST)).toHaveLength(1);
  });
});
