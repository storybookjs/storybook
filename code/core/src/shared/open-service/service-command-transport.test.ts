/**
 * Tests for remote command execution: a runtime without a local handler requests execution from a
 * peer, and a runtime that has one responds. The protocol (`service-transport.ts`) is documented on
 * {@link connectCommandTransport}.
 *
 * Peers are simulated with the test channel's `emitExternal`, the same approach the sync tests use.
 */
import * as v from 'valibot';
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';

import {
  awaitedPreloadValueServiceDef,
  entryIdInputSchema,
  mutableRecordLookupServiceDef,
  preloadedValueOutputSchema,
  voidOutputSchema,
} from './fixtures.ts';
import { defineService } from './service-definition.ts';
import {
  SERVICE_COMMAND_ACK,
  SERVICE_COMMAND_ERROR,
  SERVICE_COMMAND_INVOKE,
  SERVICE_COMMAND_RESULT,
  SERVICE_COMMAND_UNHANDLED,
  SERVICE_PATCHES,
  type CommandErrorPayload,
  type CommandInvokePayload,
  type ServiceChannel,
} from './service-channel.ts';
import { deserializeError } from './service-error-serialization.ts';
import { clearRegistry, registerService, unregisterService } from './service-registry.ts';
import { REMOTE_COMMAND_ACK_TIMEOUT_MS, connectCommandTransport } from './service-transport.ts';
import { createTestChannel, installTestChannel } from '../../channels/test-channel.ts';

const remoteOnlyServiceDef = defineService({
  id: 'internal-fixture/remote-only-command',
  description: 'Declares a command with no local handler so it must run remotely.',
  initialState: {} as Record<string, never>,
  queries: {},
  commands: {
    doThing: {
      description: 'Has no local handler in this runtime.',
      input: v.object({ value: v.string() }),
      output: v.string(),
    },
  },
});

const throwingCommandServiceDef = defineService({
  id: 'internal-fixture/throwing-command',
  description: 'Implements a command that always throws, to exercise error replies.',
  initialState: {} as Record<string, never>,
  queries: {},
  commands: {
    boom: {
      description: 'Throws an error with a cause.',
      input: v.object({}),
      output: v.void(),
      handler: async () => {
        throw new Error('kaboom', { cause: new Error('root cause') });
      },
    },
  },
});

/** Query `load` invokes a command that has no handler in this runtime (peer-only). */
const loadInvokesRemoteCommandServiceDef = defineService({
  id: 'internal-fixture/load-invokes-remote-command',
  description: 'Query load calls a command declared without a local handler.',
  initialState: {} as Record<string, string | undefined>,
  queries: {
    preloadedValue: {
      description: 'Populates state via a remote-only command inside load.',
      input: entryIdInputSchema,
      output: preloadedValueOutputSchema,
      handler: (input, ctx) => ctx.self.state[input.entryId] ?? null,
      load: (input, ctx) => ctx.self.commands.preloadValue(input).then(() => undefined),
    },
  },
  commands: {
    preloadValue: {
      description: 'Populates one entry — implemented only on a peer in this test runtime.',
      input: entryIdInputSchema,
      output: voidOutputSchema,
    },
  },
});

function emittedCalls(channel: ReturnType<typeof createTestChannel>, event: string) {
  return channel.emit.mock.calls.filter(([name]) => name === event);
}

afterEach(() => {
  vi.useRealTimers();
  clearRegistry();
  installTestChannel(null);
});

describe('remote command requester (no local handler)', () => {
  it('emits a command-invoke envelope when the command is called', () => {
    const channel = createTestChannel();
    installTestChannel(channel);

    const service = registerService(remoteOnlyServiceDef);
    service.commands.doThing({ value: 'hi' }).catch(() => {});

    const invokes = emittedCalls(channel, SERVICE_COMMAND_INVOKE);
    expect(invokes).toHaveLength(1);
    expect(invokes[0][1]).toMatchObject({
      serviceId: remoteOnlyServiceDef.id,
      commandName: 'doThing',
      input: { value: 'hi' },
      callId: expect.any(String),
      clientId: expect.any(String),
    });

    unregisterService(remoteOnlyServiceDef.id);
  });

  it('resolves with the result of the matching command-result reply', async () => {
    const channel = createTestChannel();
    installTestChannel(channel);

    const service = registerService(remoteOnlyServiceDef);
    const promise = service.commands.doThing({ value: 'hi' });

    const { callId } = emittedCalls(channel, SERVICE_COMMAND_INVOKE)[0][1] as CommandInvokePayload;
    channel.emitExternal(SERVICE_COMMAND_RESULT, {
      serviceId: remoteOnlyServiceDef.id,
      callId,
      result: 'done',
      clientId: 'peer',
    });

    await expect(promise).resolves.toBe('done');
  });

  it('rejects with the reconstructed error from a command-error reply', async () => {
    const channel = createTestChannel();
    installTestChannel(channel);

    const service = registerService(remoteOnlyServiceDef);
    const promise = service.commands.doThing({ value: 'hi' });

    const { callId } = emittedCalls(channel, SERVICE_COMMAND_INVOKE)[0][1] as CommandInvokePayload;
    channel.emitExternal(SERVICE_COMMAND_ERROR, {
      serviceId: remoteOnlyServiceDef.id,
      callId,
      clientId: 'peer',
      error: {
        __openServiceError__: true,
        name: 'OpenServiceValidationError',
        message: 'invalid input',
        properties: { fromStorybook: true, code: 5 },
      },
    });

    await expect(promise).rejects.toMatchObject({
      message: 'invalid input',
      fromStorybook: true,
      code: 5,
    });
  });

  it('keeps only the first reply when several peers answer one call', async () => {
    const channel = createTestChannel();
    installTestChannel(channel);

    const service = registerService(remoteOnlyServiceDef);
    const promise = service.commands.doThing({ value: 'hi' });

    const { callId } = emittedCalls(channel, SERVICE_COMMAND_INVOKE)[0][1] as CommandInvokePayload;
    channel.emitExternal(SERVICE_COMMAND_RESULT, {
      serviceId: remoteOnlyServiceDef.id,
      callId,
      result: 'first',
      clientId: 'peer-1',
    });
    // A later reply for the same call (a second implementer) must be ignored, not throw.
    expect(() =>
      channel.emitExternal(SERVICE_COMMAND_RESULT, {
        serviceId: remoteOnlyServiceDef.id,
        callId,
        result: 'second',
        clientId: 'peer-2',
      })
    ).not.toThrow();

    await expect(promise).resolves.toBe('first');
  });

  it('ignores replies addressed to a different service or an unknown call', async () => {
    const channel = createTestChannel();
    installTestChannel(channel);

    const service = registerService(remoteOnlyServiceDef);
    const promise = service.commands.doThing({ value: 'hi' });

    const { callId } = emittedCalls(channel, SERVICE_COMMAND_INVOKE)[0][1] as CommandInvokePayload;
    channel.emitExternal(SERVICE_COMMAND_RESULT, {
      serviceId: 'some/other-service',
      callId,
      result: 'wrong-service',
      clientId: 'peer',
    });
    channel.emitExternal(SERVICE_COMMAND_RESULT, {
      serviceId: remoteOnlyServiceDef.id,
      callId: 'unknown-call',
      result: 'wrong-call',
      clientId: 'peer',
    });
    channel.emitExternal(SERVICE_COMMAND_RESULT, {
      serviceId: remoteOnlyServiceDef.id,
      callId,
      result: 'correct',
      clientId: 'peer',
    });

    await expect(promise).resolves.toBe('correct');
  });

  it('rejects when no peer acknowledges the invoke within the timeout', async () => {
    vi.useFakeTimers();

    const channel = createTestChannel();
    installTestChannel(channel);

    const service = registerService(remoteOnlyServiceDef);
    const promise = service.commands.doThing({ value: 'hi' });
    const assertion = expect(promise).rejects.toThrow(
      'No runtime acknowledged remote command "internal-fixture/remote-only-command.doThing"; its handler is not implemented in any connected runtime.'
    );

    await vi.advanceTimersByTimeAsync(REMOTE_COMMAND_ACK_TIMEOUT_MS);
    await assertion;
  });

  it('does not reject after a peer acknowledges the invoke', async () => {
    vi.useFakeTimers();

    const channel = createTestChannel();
    installTestChannel(channel);

    const service = registerService(remoteOnlyServiceDef);
    const promise = service.commands.doThing({ value: 'hi' });

    const { callId } = emittedCalls(channel, SERVICE_COMMAND_INVOKE)[0][1] as CommandInvokePayload;
    channel.emitExternal(SERVICE_COMMAND_ACK, {
      serviceId: remoteOnlyServiceDef.id,
      callId,
      clientId: 'peer',
    });

    await vi.advanceTimersByTimeAsync(REMOTE_COMMAND_ACK_TIMEOUT_MS);

    channel.emitExternal(SERVICE_COMMAND_RESULT, {
      serviceId: remoteOnlyServiceDef.id,
      callId,
      result: 'done',
      clientId: 'peer',
    });

    await expect(promise).resolves.toBe('done');
  });

  it('rejects in-flight remote calls when the service is unregistered', async () => {
    const channel = createTestChannel();
    installTestChannel(channel);

    const service = registerService(remoteOnlyServiceDef);
    const promise = service.commands.doThing({ value: 'hi' });

    unregisterService(remoteOnlyServiceDef.id);

    await expect(promise).rejects.toThrow(/unregistered before a remote command resolved/);
  });
});

describe('remote command responder (has local handler)', () => {
  it('acknowledges, runs the command, broadcasts state, and replies with the result', async () => {
    const channel = createTestChannel();
    installTestChannel(channel);

    const service = registerService(mutableRecordLookupServiceDef);

    channel.emitExternal(SERVICE_COMMAND_INVOKE, {
      serviceId: mutableRecordLookupServiceDef.id,
      commandName: 'assignRecordField',
      input: { entryId: 'a', fieldKey: 'k', fieldValue: 'v' },
      callId: 'call-1',
      clientId: 'requester',
    });

    // The ack is emitted synchronously on receipt, before the command runs.
    expect(channel.emit).toHaveBeenCalledWith(
      SERVICE_COMMAND_ACK,
      expect.objectContaining({
        serviceId: mutableRecordLookupServiceDef.id,
        callId: 'call-1',
        clientId: expect.any(String),
      })
    );

    await vi.waitFor(() =>
      expect(channel.emit).toHaveBeenCalledWith(
        SERVICE_COMMAND_RESULT,
        expect.objectContaining({ callId: 'call-1', serviceId: mutableRecordLookupServiceDef.id })
      )
    );

    expect(service.queries.recordFields.get({ entryId: 'a' })).toEqual({ k: 'v' });
    expect(emittedCalls(channel, SERVICE_PATCHES).length).toBeGreaterThan(0);
  });

  it('replies with a serialized error (including the cause) when the handler throws', async () => {
    const channel = createTestChannel();
    installTestChannel(channel);

    registerService(throwingCommandServiceDef);

    channel.emitExternal(SERVICE_COMMAND_INVOKE, {
      serviceId: throwingCommandServiceDef.id,
      commandName: 'boom',
      input: {},
      callId: 'call-err',
      clientId: 'requester',
    });

    await vi.waitFor(() => expect(emittedCalls(channel, SERVICE_COMMAND_ERROR)).toHaveLength(1));

    const payload = emittedCalls(channel, SERVICE_COMMAND_ERROR)[0][1] as CommandErrorPayload;
    expect(payload).toMatchObject({ serviceId: throwingCommandServiceDef.id, callId: 'call-err' });

    const restored = deserializeError(payload.error);
    expect(restored.message).toBe('kaboom');
    expect((restored.cause as Error).message).toBe('root cause');
  });

  it('reports an invoke for a hosted command it does not implement instead of acking', async () => {
    const channel = createTestChannel();
    installTestChannel(channel);

    // This runtime has no local handler for `doThing`, so it must report rather than answer.
    registerService(remoteOnlyServiceDef);

    channel.emitExternal(SERVICE_COMMAND_INVOKE, {
      serviceId: remoteOnlyServiceDef.id,
      commandName: 'doThing',
      input: { value: 'hi' },
      callId: 'call-unhandled',
      clientId: 'requester',
    });

    await new Promise<void>((resolve) => setTimeout(resolve, 10));

    expect(emittedCalls(channel, SERVICE_COMMAND_ACK)).toHaveLength(0);
    expect(emittedCalls(channel, SERVICE_COMMAND_RESULT)).toHaveLength(0);
    expect(emittedCalls(channel, SERVICE_COMMAND_UNHANDLED)).toEqual([
      [
        SERVICE_COMMAND_UNHANDLED,
        expect.objectContaining({
          serviceId: remoteOnlyServiceDef.id,
          callId: 'call-unhandled',
          clientId: expect.any(String),
        }),
      ],
    ]);
  });
});

// Models the dev server's channel (`async: true`): every emitted event needs an event-loop turn
// before it reaches the wire, like a websocket write behind `setImmediate`.
function createMacrotaskDeliveryChannel(): ServiceChannel {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  return {
    on: (eventName, listener) => {
      const existing = listeners.get(eventName) ?? new Set();
      existing.add(listener);
      listeners.set(eventName, existing);
    },
    off: (eventName, listener) => {
      listeners.get(eventName)?.delete(listener);
    },
    emit: (eventName, ...args) => {
      setImmediate(() => {
        listeners.get(eventName)?.forEach((listener) => listener(...args));
      });
    },
  };
}

describe('ack delivery with a busy responder', () => {
  // retry: real timers are required here (the starvation is wall-clock), so an extreme scheduler
  // stall could fire the ack window early; the regression itself fails deterministically.
  it(
    'resolves the requester when the responder handler occupies the microtask queue past the ack window',
    { retry: 3 },
    async () => {
      const channel = createMacrotaskDeliveryChannel();
      const serviceId = 'internal-fixture/busy-responder';

      const requester = connectCommandTransport({
        serviceId,
        ownClientId: 'requester',
        channel,
        localCommands: {},
        implementedCommandNames: new Set(),
        commandNames: ['fanOut'],
        delegated: false,
      });
      const responder = connectCommandTransport({
        serviceId,
        ownClientId: 'responder',
        channel,
        localCommands: {
          fanOut: async (input) => {
            const end = Date.now() + REMOTE_COMMAND_ACK_TIMEOUT_MS + 100;
            while (Date.now() < end) {
              await Promise.resolve();
            }
            return `fanned-out:${(input as { value: string }).value}`;
          },
        },
        implementedCommandNames: new Set(['fanOut']),
        commandNames: ['fanOut'],
        delegated: false,
      });
      onTestFinished(() => {
        requester.disconnect();
        responder.disconnect();
      });

      await expect(requester.commands.fanOut({ value: 'all' })).resolves.toBe('fanned-out:all');
    }
  );
});

describe('command-unhandled reporting', () => {
  it('rejects a delegated requester promptly when the peer reports the command unhandled', async () => {
    const channel = createMacrotaskDeliveryChannel();
    const serviceId = 'internal-fixture/drifted-instance';

    const requester = connectCommandTransport({
      serviceId,
      ownClientId: 'requester',
      channel,
      localCommands: {},
      implementedCommandNames: new Set(),
      commandNames: ['fanOut'],
      delegated: true,
    });
    const responder = connectCommandTransport({
      serviceId,
      ownClientId: 'responder',
      channel,
      localCommands: {},
      implementedCommandNames: new Set(),
      commandNames: ['fanOut'],
      delegated: false,
    });
    onTestFinished(() => {
      requester.disconnect();
      responder.disconnect();
    });

    await expect(requester.commands.fanOut({ value: 'all' })).rejects.toThrow(
      'reported it has no handler for remote command "internal-fixture/drifted-instance.fanOut"'
    );
  });

  it('does not report a service id this realm registered earlier', async () => {
    const channel = createTestChannel();
    installTestChannel(channel);

    registerService(remoteOnlyServiceDef);
    unregisterService(remoteOnlyServiceDef.id);

    channel.emitExternal(SERVICE_COMMAND_INVOKE, {
      serviceId: remoteOnlyServiceDef.id,
      commandName: 'doThing',
      input: { value: 'hi' },
      callId: 'call-mid-hmr',
      clientId: 'requester',
    });

    expect(emittedCalls(channel, SERVICE_COMMAND_UNHANDLED)).toHaveLength(0);
  });

  it('still resolves a non-delegated requester when another peer answers after an unhandled report', async () => {
    const channel = createTestChannel();
    installTestChannel(channel);

    const service = registerService(remoteOnlyServiceDef);
    const promise = service.commands.doThing({ value: 'hi' });

    const { callId } = emittedCalls(channel, SERVICE_COMMAND_INVOKE)[0][1] as CommandInvokePayload;
    channel.emitExternal(SERVICE_COMMAND_UNHANDLED, {
      serviceId: remoteOnlyServiceDef.id,
      callId,
      clientId: 'peer-without-handler',
    });
    channel.emitExternal(SERVICE_COMMAND_RESULT, {
      serviceId: remoteOnlyServiceDef.id,
      callId,
      result: 'done',
      clientId: 'peer-with-handler',
    });

    await expect(promise).resolves.toBe('done');
  });

  it('reports an invoke for a service this realm does not register at all', async () => {
    const channel = createTestChannel();
    installTestChannel(channel);

    registerService(remoteOnlyServiceDef);

    channel.emitExternal(SERVICE_COMMAND_INVOKE, {
      serviceId: 'other/never-registered',
      commandName: 'doThing',
      input: {},
      callId: 'call-unknown-service',
      clientId: 'requester',
    });

    expect(emittedCalls(channel, SERVICE_COMMAND_UNHANDLED)).toEqual([
      [
        SERVICE_COMMAND_UNHANDLED,
        expect.objectContaining({
          serviceId: 'other/never-registered',
          callId: 'call-unknown-service',
        }),
      ],
    ]);
  });
});

describe('load bodies and command routing', () => {
  it('calls the local command handler from a load body without emitting command-invoke', async () => {
    const channel = createTestChannel();
    installTestChannel(channel);
    const handlerSpy = vi.spyOn(awaitedPreloadValueServiceDef.commands.preloadValue, 'handler');
    onTestFinished(() => {
      handlerSpy.mockRestore();
    });

    const service = registerService(awaitedPreloadValueServiceDef);

    await service.queries.preloadedValue.loaded({ entryId: 'entry-a' });

    expect(handlerSpy).toHaveBeenCalledTimes(1);
    expect(handlerSpy.mock.calls[0]?.[0]).toEqual({ entryId: 'entry-a' });
    expect(emittedCalls(channel, SERVICE_COMMAND_INVOKE)).toHaveLength(0);
    expect(service.queries.preloadedValue.get({ entryId: 'entry-a' })).toBe('preloaded');
  });

  it('routes a load-body command through command-invoke when no local handler exists', async () => {
    const channel = createTestChannel();
    installTestChannel(channel);

    const service = registerService(loadInvokesRemoteCommandServiceDef);
    const promise = service.queries.preloadedValue.loaded({ entryId: 'entry-a' });

    await vi.waitFor(() => expect(emittedCalls(channel, SERVICE_COMMAND_INVOKE)).toHaveLength(1));

    expect(emittedCalls(channel, SERVICE_COMMAND_INVOKE)[0]?.[1]).toMatchObject({
      serviceId: loadInvokesRemoteCommandServiceDef.id,
      commandName: 'preloadValue',
      input: { entryId: 'entry-a' },
      callId: expect.any(String),
      clientId: expect.any(String),
    });

    const { callId } = emittedCalls(
      channel,
      SERVICE_COMMAND_INVOKE
    )[0]?.[1] as CommandInvokePayload;
    channel.emitExternal(SERVICE_COMMAND_RESULT, {
      serviceId: loadInvokesRemoteCommandServiceDef.id,
      callId,
      result: undefined,
      clientId: 'peer',
    });

    await expect(promise).resolves.toBeNull();
  });
});
