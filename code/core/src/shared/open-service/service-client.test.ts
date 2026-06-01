import { afterEach, describe, expect, it, vi } from 'vitest';

import { mutableRecordLookupServiceDef } from './fixtures.ts';
import {
  SERVICE_PATCHES,
  SERVICE_WELCOME_REPLY,
  SERVICE_WELCOME_REQUEST,
  clearServiceChannel,
  setServiceChannel,
} from './service-channel.ts';
import {
  clearClientRegistry,
  registerServiceClient,
  unregisterServiceClient,
} from './service-client.ts';

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

afterEach(() => {
  clearClientRegistry();
  clearServiceChannel();
});

// ---- Basic registration ----

describe('registerServiceClient', () => {
  it('returns a service with functional queries', () => {
    const service = registerServiceClient(mutableRecordLookupServiceDef);
    expect(service.queries.getRecordFields({ entryId: 'a' })).toBeNull();
  });

  it('reflects state after a local command', async () => {
    const service = registerServiceClient(mutableRecordLookupServiceDef);

    await service.commands.assignRecordField({
      entryId: 'a',
      fieldKey: 'color',
      fieldValue: 'blue',
    });

    expect(service.queries.getRecordFields({ entryId: 'a' })).toEqual({ color: 'blue' });
  });

  it('throws on duplicate registration', () => {
    registerServiceClient(mutableRecordLookupServiceDef);

    expect(() => registerServiceClient(mutableRecordLookupServiceDef)).toThrow(
      'already registered'
    );
  });

  it('re-registration succeeds after unregisterServiceClient', () => {
    registerServiceClient(mutableRecordLookupServiceDef);
    unregisterServiceClient(mutableRecordLookupServiceDef.id);

    expect(() => registerServiceClient(mutableRecordLookupServiceDef)).not.toThrow();
  });
});

// ---- Subscription ----

describe('subscriptions', () => {
  it('delivers the current value immediately', async () => {
    const service = registerServiceClient(mutableRecordLookupServiceDef);
    const received: unknown[] = [];

    service.queries.getRecordFields.subscribe({ entryId: 'a' }, (v) => received.push(v));

    await vi.waitFor(() => expect(received).toHaveLength(1));
    expect(received[0]).toBeNull();
  });

  it('re-fires on state change from a local command', async () => {
    const service = registerServiceClient(mutableRecordLookupServiceDef);
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
    setServiceChannel(channel);

    registerServiceClient(mutableRecordLookupServiceDef);

    expect(channel.emit).toHaveBeenCalledWith(
      SERVICE_WELCOME_REQUEST,
      expect.objectContaining({ serviceId: mutableRecordLookupServiceDef.id })
    );
  });

  it('applies state from a welcome-reply from an external peer', async () => {
    const channel = createMockChannel();
    setServiceChannel(channel);

    const service = registerServiceClient(mutableRecordLookupServiceDef);

    channel.emitExternal(SERVICE_WELCOME_REPLY, {
      serviceId: mutableRecordLookupServiceDef.id,
      state: { 'entry-x': { label: 'hello' } },
      clientId: 'peer-abc',
    });

    await vi.waitFor(() =>
      expect(service.queries.getRecordFields({ entryId: 'entry-x' })).toEqual({ label: 'hello' })
    );
  });

  it('responds to a welcome-request from an external peer', async () => {
    const channel = createMockChannel();
    setServiceChannel(channel);

    const service = registerServiceClient(mutableRecordLookupServiceDef);

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
    setServiceChannel(channel);

    registerServiceClient(mutableRecordLookupServiceDef);

    // The welcome-request emitted on registration echoes back through the channel.
    // The client must NOT reply to itself.
    const replyCalls = channel.emit.mock.calls.filter(([event]) => event === SERVICE_WELCOME_REPLY);
    expect(replyCalls).toHaveLength(0);
  });
});

describe('channel: patch broadcast', () => {
  it('broadcasts services:patches after a local command', async () => {
    const channel = createMockChannel();
    setServiceChannel(channel);

    const service = registerServiceClient(mutableRecordLookupServiceDef);

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
    setServiceChannel(channel);

    const service = registerServiceClient(mutableRecordLookupServiceDef);

    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: mutableRecordLookupServiceDef.id,
      state: { 'entry-y': { marker: 'set' } },
      clientId: 'peer-xyz',
    });

    await vi.waitFor(() =>
      expect(service.queries.getRecordFields({ entryId: 'entry-y' })).toEqual({ marker: 'set' })
    );
  });

  it('does not re-apply its own patch echo (loop prevention)', async () => {
    const channel = createMockChannel();
    setServiceChannel(channel);

    const service = registerServiceClient(mutableRecordLookupServiceDef);

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
    setServiceChannel(channel);

    const service = registerServiceClient(mutableRecordLookupServiceDef);

    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: 'some-other-service',
      state: { 'entry-z': { x: '1' } },
      clientId: 'peer-xyz',
    });

    await new Promise<void>((resolve) => setTimeout(resolve, 10));

    expect(service.queries.getRecordFields({ entryId: 'entry-z' })).toBeNull();
  });
});

describe('channel: disconnect on unregister', () => {
  it('stops listening after unregisterServiceClient', () => {
    const channel = createMockChannel();
    setServiceChannel(channel);

    registerServiceClient(mutableRecordLookupServiceDef);
    unregisterServiceClient(mutableRecordLookupServiceDef.id);

    // All three event listeners should have been torn down
    expect(channel.off).toHaveBeenCalledWith(SERVICE_WELCOME_REQUEST, expect.any(Function));
    expect(channel.off).toHaveBeenCalledWith(SERVICE_WELCOME_REPLY, expect.any(Function));
    expect(channel.off).toHaveBeenCalledWith(SERVICE_PATCHES, expect.any(Function));
  });
});

describe('no channel installed', () => {
  it('service works normally without a channel', async () => {
    const service = registerServiceClient(mutableRecordLookupServiceDef);

    await service.commands.assignRecordField({
      entryId: 'c',
      fieldKey: 'val',
      fieldValue: 'local',
    });

    expect(service.queries.getRecordFields({ entryId: 'c' })).toEqual({ val: 'local' });
  });
});
