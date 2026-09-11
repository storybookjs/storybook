import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from 'storybook/internal/client-logger';

import { createTestChannel } from '../../channels/test-channel.ts';
import { SERVICE_ENTRY, SERVICE_SYNC_REPLY, SERVICE_SYNC_REQUEST } from './service-channel.ts';
import { createSnapshotReconciler } from './service-sync.ts';
import { connectRuntimeToChannel } from './service-transport.ts';

vi.mock('storybook/internal/client-logger', { spy: true });

const SERVICE_ID = 'internal-fixture/transport-sync';

describe('connectRuntimeToChannel request policy', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(logger.warn).mockReset();
    vi.mocked(logger.warn).mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends a sync-request for a beyond-window entry', () => {
    const channel = createTestChannel();
    const state: Record<string, unknown> = {};
    const getSnapshot = vi.fn(() => ({ ...state }));
    const reconciler = createSnapshotReconciler({
      setState: (mutate) => mutate(state),
      window: { maxAgeMs: 0, maxEntries: 2 },
    });

    const disconnect = connectRuntimeToChannel({
      serviceId: SERVICE_ID,
      ownRuntimeId: 'self',
      reconciler,
      getSnapshot,
      channel,
      relay: false,
    });
    vi.advanceTimersByTime(1000);
    channel.emit.mockClear();

    channel.emitExternal(SERVICE_ENTRY, {
      serviceId: SERVICE_ID,
      stamp: { seq: 1, runtimeId: 'w', counter: 1 },
      command: 'setA',
      patch: [{ op: 'add', path: '/a', value: 1 }],
    });
    channel.emitExternal(SERVICE_ENTRY, {
      serviceId: SERVICE_ID,
      stamp: { seq: 2, runtimeId: 'w', counter: 2 },
      command: 'setB',
      patch: [{ op: 'add', path: '/b', value: 2 }],
    });
    channel.emitExternal(SERVICE_ENTRY, {
      serviceId: SERVICE_ID,
      stamp: { seq: 3, runtimeId: 'w', counter: 3 },
      command: 'setC',
      patch: [{ op: 'add', path: '/c', value: 3 }],
    });
    channel.emit.mockClear();

    channel.emitExternal(SERVICE_ENTRY, {
      serviceId: SERVICE_ID,
      stamp: { seq: 1, runtimeId: 'other', counter: 1 },
      command: 'setZ',
      patch: [{ op: 'add', path: '/z', value: 9 }],
    });

    expect(
      channel.emit.mock.calls.filter(([event]) => event === SERVICE_SYNC_REQUEST)
    ).toHaveLength(1);

    disconnect();
  });

  it('sends a queued repair request after bootstrap silence when a gap arrives during the cooldown', () => {
    const channel = createTestChannel();
    const state: Record<string, unknown> = {};
    const getSnapshot = vi.fn(() => ({ ...state }));
    const reconciler = createSnapshotReconciler({
      setState: (mutate) => mutate(state),
    });

    const disconnect = connectRuntimeToChannel({
      serviceId: SERVICE_ID,
      ownRuntimeId: 'self',
      reconciler,
      getSnapshot,
      channel,
      relay: false,
    });

    expect(
      channel.emit.mock.calls.filter(([event]) => event === SERVICE_SYNC_REQUEST)
    ).toHaveLength(1);
    channel.emit.mockClear();

    channel.emitExternal(SERVICE_ENTRY, {
      serviceId: SERVICE_ID,
      stamp: { seq: 2, runtimeId: 'w', counter: 2 },
      command: 'setA',
      patch: [{ op: 'add', path: '/a', value: 1 }],
    });
    expect(
      channel.emit.mock.calls.filter(([event]) => event === SERVICE_SYNC_REQUEST)
    ).toHaveLength(0);

    vi.advanceTimersByTime(1000);

    const requests = channel.emit.mock.calls.filter(([event]) => event === SERVICE_SYNC_REQUEST);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.[1]).toEqual({
      serviceId: SERVICE_ID,
      runtimeId: 'self',
      frontier: reconciler.frontier,
    });
    expect(reconciler.frontier).toEqual({ vector: {}, clock: 2 });

    disconnect();
  });

  it('sends a queued repair after an installed reply', () => {
    const channel = createTestChannel();
    const state: Record<string, unknown> = {};
    const getSnapshot = vi.fn(() => ({ ...state }));
    const reconciler = createSnapshotReconciler({
      setState: (mutate) => mutate(state),
    });

    const disconnect = connectRuntimeToChannel({
      serviceId: SERVICE_ID,
      ownRuntimeId: 'self',
      reconciler,
      getSnapshot,
      channel,
      relay: false,
    });
    channel.emit.mockClear();

    channel.emitExternal(SERVICE_ENTRY, {
      serviceId: SERVICE_ID,
      stamp: { seq: 2, runtimeId: 'w', counter: 2 },
      command: 'setA',
      patch: [{ op: 'add', path: '/a', value: 1 }],
    });
    expect(
      channel.emit.mock.calls.filter(([event]) => event === SERVICE_SYNC_REQUEST)
    ).toHaveLength(0);

    channel.emitExternal(SERVICE_SYNC_REPLY, {
      serviceId: SERVICE_ID,
      frontier: { vector: { w: 2 }, clock: 2 },
      state: { a: 1 },
    });

    const requests = channel.emit.mock.calls.filter(([event]) => event === SERVICE_SYNC_REQUEST);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.[1]).toEqual({
      serviceId: SERVICE_ID,
      runtimeId: 'self',
      frontier: reconciler.frontier,
    });
    expect(state).toEqual({ a: 1 });

    disconnect();
  });

  it('sends a queued repair after an installed reply that does not cover the gap', () => {
    const channel = createTestChannel();
    const state: Record<string, unknown> = {};
    const getSnapshot = vi.fn(() => ({ ...state }));
    const reconciler = createSnapshotReconciler({
      setState: (mutate) => mutate(state),
    });

    const disconnect = connectRuntimeToChannel({
      serviceId: SERVICE_ID,
      ownRuntimeId: 'self',
      reconciler,
      getSnapshot,
      channel,
      relay: false,
    });
    channel.emit.mockClear();

    channel.emitExternal(SERVICE_ENTRY, {
      serviceId: SERVICE_ID,
      stamp: { seq: 2, runtimeId: 'w', counter: 2 },
      command: 'setA',
      patch: [{ op: 'add', path: '/a', value: 1 }],
    });
    expect(
      channel.emit.mock.calls.filter(([event]) => event === SERVICE_SYNC_REQUEST)
    ).toHaveLength(0);
    expect(reconciler.vector).toEqual({});

    channel.emitExternal(SERVICE_SYNC_REPLY, {
      serviceId: SERVICE_ID,
      frontier: { vector: { z: 1 }, clock: 1 },
      state: { z: 1 },
    });

    const requests = channel.emit.mock.calls.filter(([event]) => event === SERVICE_SYNC_REQUEST);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.[1]).toEqual({
      serviceId: SERVICE_ID,
      runtimeId: 'self',
      frontier: reconciler.frontier,
    });
    expect(reconciler.vector).toEqual({ z: 1 });
    expect(reconciler.frontier.clock).toBe(2);
    expect(state).toEqual({ z: 1, a: 1 });

    disconnect();
  });

  it('re-emits a queued repair when a concurrent reply is dropped', () => {
    const channel = createTestChannel();
    const state: Record<string, unknown> = { n: 1 };
    const getSnapshot = vi.fn(() => ({ ...state }));
    const reconciler = createSnapshotReconciler({
      setState: (mutate) => mutate(state),
    });
    reconciler.tryAdoptEntry({
      serviceId: SERVICE_ID,
      stamp: { seq: 1, runtimeId: 'self', counter: 1 },
      command: 'setN',
      patch: [{ op: 'replace', path: '/n', value: 1 }],
    });

    const disconnect = connectRuntimeToChannel({
      serviceId: SERVICE_ID,
      ownRuntimeId: 'self',
      reconciler,
      getSnapshot,
      channel,
      relay: false,
    });
    channel.emit.mockClear();

    channel.emitExternal(SERVICE_ENTRY, {
      serviceId: SERVICE_ID,
      stamp: { seq: 2, runtimeId: 'w', counter: 2 },
      command: 'setA',
      patch: [{ op: 'add', path: '/a', value: 1 }],
    });
    expect(
      channel.emit.mock.calls.filter(([event]) => event === SERVICE_SYNC_REQUEST)
    ).toHaveLength(0);

    channel.emitExternal(SERVICE_SYNC_REPLY, {
      serviceId: SERVICE_ID,
      frontier: { vector: { other: 1 }, clock: 1 },
      state: { n: 99 },
    });

    const requests = channel.emit.mock.calls.filter(([event]) => event === SERVICE_SYNC_REQUEST);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.[1]).toEqual({
      serviceId: SERVICE_ID,
      runtimeId: 'self',
      frontier: reconciler.frontier,
    });

    disconnect();
  });

  it('calls getSnapshot only when answering a dominating request', () => {
    const channel = createTestChannel();
    const state: Record<string, unknown> = { n: 1 };
    const getSnapshot = vi.fn(() => ({ ...state }));
    const reconciler = createSnapshotReconciler({
      setState: (mutate) => mutate(state),
    });
    reconciler.tryAdoptEntry({
      serviceId: SERVICE_ID,
      stamp: { seq: 1, runtimeId: 'self', counter: 1 },
      command: 'setN',
      patch: [{ op: 'replace', path: '/n', value: 1 }],
    });

    const disconnect = connectRuntimeToChannel({
      serviceId: SERVICE_ID,
      ownRuntimeId: 'self',
      reconciler,
      getSnapshot,
      channel,
      relay: false,
    });
    getSnapshot.mockClear();

    channel.emitExternal(SERVICE_SYNC_REQUEST, {
      serviceId: SERVICE_ID,
      runtimeId: 'ahead',
      frontier: { vector: { ahead: 9 }, clock: 9 },
    });
    expect(getSnapshot).not.toHaveBeenCalled();
    expect(channel.emit.mock.calls.filter(([event]) => event === SERVICE_SYNC_REPLY)).toHaveLength(
      0
    );

    channel.emitExternal(SERVICE_SYNC_REQUEST, {
      serviceId: SERVICE_ID,
      runtimeId: 'joiner',
      frontier: { vector: {}, clock: 0 },
    });
    expect(getSnapshot).toHaveBeenCalledTimes(1);
    expect(channel.emit).toHaveBeenCalledWith(
      SERVICE_SYNC_REPLY,
      expect.objectContaining({ serviceId: SERVICE_ID, state: { n: 1 } })
    );

    disconnect();
  });
});
