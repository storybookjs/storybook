/**
 * Tests for remote command execution: a runtime without a local handler requests execution from a
 * peer, and a runtime that has one responds. The protocol (`service-transport.ts`) is documented on
 * {@link connectCommandTransport}.
 *
 * Peers are simulated with the test channel's `emitExternal`, the same approach the sync tests use.
 */
import * as v from 'valibot';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
  SERVICE_PATCHES,
  type CommandErrorPayload,
  type CommandInvokePayload,
} from './service-channel.ts';
import { deserializeError } from './service-error-serialization.ts';
import { clearRegistry, registerService, unregisterService } from './service-registry.ts';
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
    getPreloadedValue: {
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
  clearRegistry();
  installTestChannel(null);
});

describe('remote command requester (no local handler)', () => {
  it('emits a command-invoke envelope when the command is called', () => {
    const channel = createTestChannel();
    installTestChannel(channel);

    const service = registerService(remoteOnlyServiceDef);
    // Never settled in this test; swallow the unregister rejection clearRegistry triggers in afterEach.
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

    expect(service.queries.getRecordFields({ entryId: 'a' })).toEqual({ k: 'v' });
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

  it('ignores invokes for commands it does not implement', async () => {
    const channel = createTestChannel();
    installTestChannel(channel);

    // This runtime has no local handler for `doThing`, so it must not answer the invoke.
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
  });
});

describe('load bodies and command routing', () => {
  it('calls the local command handler from a load body without emitting command-invoke', async () => {
    const channel = createTestChannel();
    installTestChannel(channel);
    const handlerSpy = vi.spyOn(awaitedPreloadValueServiceDef.commands.preloadValue, 'handler');

    try {
      const service = registerService(awaitedPreloadValueServiceDef);

      await service.queries.getPreloadedValue.loaded({ entryId: 'entry-a' });

      expect(handlerSpy).toHaveBeenCalledTimes(1);
      expect(handlerSpy.mock.calls[0]?.[0]).toEqual({ entryId: 'entry-a' });
      expect(emittedCalls(channel, SERVICE_COMMAND_INVOKE)).toHaveLength(0);
      expect(service.queries.getPreloadedValue({ entryId: 'entry-a' })).toBe('preloaded');
    } finally {
      handlerSpy.mockRestore();
    }
  });

  it('routes a load-body command through command-invoke when no local handler exists', async () => {
    const channel = createTestChannel();
    installTestChannel(channel);

    const service = registerService(loadInvokesRemoteCommandServiceDef);
    const promise = service.queries.getPreloadedValue.loaded({ entryId: 'entry-a' });

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
