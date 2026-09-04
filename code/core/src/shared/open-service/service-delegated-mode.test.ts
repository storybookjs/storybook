import * as v from 'valibot';

import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';

import { createTestChannel, installTestChannel } from '../../channels/test-channel.ts';
import {
  OpenServiceRemoteCommandConfigDriftError,
  OpenServiceRemoteCommandUnhandledError,
} from '../../server-errors.ts';
import { mutableRecordLookupServiceDef } from './fixtures.ts';
import {
  SERVICE_COMMAND_ACK,
  SERVICE_COMMAND_INVOKE,
  SERVICE_COMMAND_RESULT,
  SERVICE_COMMAND_UNHANDLED,
  SERVICE_PATCHES,
  type CommandInvokePayload,
} from './service-channel.ts';
import { defineService } from './service-definition.ts';
import {
  clearRegistry,
  isDelegatedMode,
  registerService,
  setDelegatedMode,
} from './service-registry.ts';
import { REMOTE_COMMAND_ACK_TIMEOUT_MS } from './service-transport.ts';

const locallyImplementedServiceDef = defineService({
  id: 'internal-fixture/delegated-local-implementation',
  description: 'Implements its command locally, so only delegation can route it to a peer.',
  initialState: {} as Record<string, never>,
  queries: {},
  commands: {
    doThing: {
      description: 'Returns a marker naming the runtime that ran it.',
      input: v.object({ value: v.string() }),
      output: v.string(),
      handler: async () => 'ran-locally',
    },
  },
});

const componentIdInputSchema = v.object({ id: v.string() });
const docgenOutputSchema = v.optional(v.string());

// Mirrors `core/docgen`: the query's load only triggers the extraction command, which writes state.
const thinLoadServiceDef = defineService({
  id: 'internal-fixture/delegated-thin-load',
  description: 'Reads extracted docgen that a command writes into state.',
  initialState: { components: {} } as { components: Record<string, string> },
  queries: {
    docgen: {
      description: 'Returns the docgen for one component id, or undefined when not extracted.',
      input: componentIdInputSchema,
      output: docgenOutputSchema,
      handler: (input, ctx) => ctx.self.state.components[input.id],
      load: async (input, ctx) => {
        await ctx.self.commands.extractDocgen(input);
      },
    },
  },
  commands: {
    extractDocgen: {
      description: 'Extracts docgen for one component id and stores it.',
      input: componentIdInputSchema,
      output: docgenOutputSchema,
      handler: async (input, ctx) => {
        ctx.self.setState((state) => {
          state.components[input.id] = 'extracted-locally';
        });
        return 'extracted-locally';
      },
    },
  },
});

function emittedCalls(channel: ReturnType<typeof createTestChannel>, event: string) {
  return channel.emit.mock.calls.filter(([name]) => name === event);
}

afterEach(() => {
  vi.useRealTimers();
  clearRegistry();
  setDelegatedMode(false);
  installTestChannel(null);
});

describe('delegated mode flag', () => {
  it('defaults to off and is reset by clearRegistry', () => {
    expect(isDelegatedMode()).toBe(false);

    setDelegatedMode(true);
    expect(isDelegatedMode()).toBe(true);

    clearRegistry();
    expect(isDelegatedMode()).toBe(false);
  });

  it('shares the flag with a separately loaded copy of this module', async () => {
    setDelegatedMode(true);

    vi.resetModules();
    const other = await import('./service-registry.ts');

    expect(isDelegatedMode()).toBe(true);
    expect(other.isDelegatedMode()).toBe(true);

    other.setDelegatedMode(false);
    expect(isDelegatedMode()).toBe(false);
  });
});

describe('delegated command dispatch', () => {
  it('invokes a locally implemented command over the channel and never runs the local handler', async () => {
    const channel = createTestChannel();
    installTestChannel(channel);
    const handlerSpy = vi.spyOn(
      mutableRecordLookupServiceDef.commands.assignRecordField,
      'handler'
    );
    onTestFinished(() => {
      handlerSpy.mockRestore();
    });

    setDelegatedMode(true);
    const service = registerService(mutableRecordLookupServiceDef);

    const promise = service.commands.assignRecordField({
      entryId: 'a',
      fieldKey: 'k',
      fieldValue: 'v',
    });

    const invokes = emittedCalls(channel, SERVICE_COMMAND_INVOKE);
    expect(invokes).toHaveLength(1);
    expect(invokes[0][1]).toMatchObject({
      serviceId: mutableRecordLookupServiceDef.id,
      commandName: 'assignRecordField',
      input: { entryId: 'a', fieldKey: 'k', fieldValue: 'v' },
    });

    const { callId } = invokes[0][1] as CommandInvokePayload;
    channel.emitExternal(SERVICE_COMMAND_ACK, {
      serviceId: mutableRecordLookupServiceDef.id,
      callId,
      clientId: 'peer',
    });
    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: mutableRecordLookupServiceDef.id,
      state: { a: { k: 'v' } },
      version: 1,
      clientId: 'peer',
    });
    channel.emitExternal(SERVICE_COMMAND_RESULT, {
      serviceId: mutableRecordLookupServiceDef.id,
      callId,
      result: undefined,
      clientId: 'peer',
    });

    await expect(promise).resolves.toBeUndefined();
    expect(handlerSpy).not.toHaveBeenCalled();
    expect(service.queries.recordFields.get({ entryId: 'a' })).toEqual({ k: 'v' });
  });

  it('ignores an incoming invoke for a command it implements', async () => {
    const channel = createTestChannel();
    installTestChannel(channel);
    const handlerSpy = vi.spyOn(
      mutableRecordLookupServiceDef.commands.assignRecordField,
      'handler'
    );
    onTestFinished(() => {
      handlerSpy.mockRestore();
    });

    setDelegatedMode(true);
    registerService(mutableRecordLookupServiceDef);

    channel.emitExternal(SERVICE_COMMAND_INVOKE, {
      serviceId: mutableRecordLookupServiceDef.id,
      commandName: 'assignRecordField',
      input: { entryId: 'a', fieldKey: 'k', fieldValue: 'v' },
      callId: 'call-1',
      clientId: 'requester',
    });

    await new Promise<void>((resolve) => setTimeout(resolve, 10));

    expect(emittedCalls(channel, SERVICE_COMMAND_ACK)).toHaveLength(0);
    expect(emittedCalls(channel, SERVICE_COMMAND_RESULT)).toHaveLength(0);
    expect(emittedCalls(channel, SERVICE_COMMAND_UNHANDLED)).toHaveLength(0);
    expect(handlerSpy).not.toHaveBeenCalled();
  });

  it('rejects with config-drift guidance when the peer reports the command unhandled', async () => {
    const channel = createTestChannel();
    installTestChannel(channel);

    setDelegatedMode(true);
    const service = registerService(locallyImplementedServiceDef);

    const promise = service.commands.doThing({ value: 'hi' });

    const { callId } = emittedCalls(channel, SERVICE_COMMAND_INVOKE)[0][1] as CommandInvokePayload;
    channel.emitExternal(SERVICE_COMMAND_UNHANDLED, {
      serviceId: locallyImplementedServiceDef.id,
      callId,
      clientId: 'instance',
    });

    const error = await promise.catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(OpenServiceRemoteCommandConfigDriftError);
    expect((error as Error).message).toBe(
      'The Storybook this runtime is attached to reported it has no handler for remote command "internal-fixture/delegated-local-implementation.doThing". The two processes are running different configurations (for example a feature flag enabled in one but not the other). Restart the attached Storybook with a configuration matching this process.'
    );
  });

  it('rejects with an unacknowledged-command error when no peer acknowledges the invoke', async () => {
    vi.useFakeTimers();

    const channel = createTestChannel();
    installTestChannel(channel);

    setDelegatedMode(true);
    const service = registerService(locallyImplementedServiceDef);

    const failure = service.commands.doThing({ value: 'hi' }).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(REMOTE_COMMAND_ACK_TIMEOUT_MS);

    const error = await failure;
    expect(error).toBeInstanceOf(OpenServiceRemoteCommandUnhandledError);
    expect((error as Error).message).toBe(
      'The Storybook this runtime is attached to did not acknowledge remote command "internal-fixture/delegated-local-implementation.doThing" in time — it may be busy or unreachable. Retry; note the command may still have executed on that instance.'
    );
  });

  it('runs the local handler without touching the channel when delegated mode is off', async () => {
    const channel = createTestChannel();
    installTestChannel(channel);
    const handlerSpy = vi.spyOn(
      mutableRecordLookupServiceDef.commands.assignRecordField,
      'handler'
    );
    onTestFinished(() => {
      handlerSpy.mockRestore();
    });

    const service = registerService(mutableRecordLookupServiceDef);

    await service.commands.assignRecordField({ entryId: 'a', fieldKey: 'k', fieldValue: 'v' });

    expect(handlerSpy).toHaveBeenCalledTimes(1);
    expect(emittedCalls(channel, SERVICE_COMMAND_INVOKE)).toHaveLength(0);
    expect(service.queries.recordFields.get({ entryId: 'a' })).toEqual({ k: 'v' });
  });
});

describe('delegated thin loads', () => {
  it('delegates the command a query load triggers and reads the peer-patched state back', async () => {
    const channel = createTestChannel();
    installTestChannel(channel);
    const handlerSpy = vi.spyOn(thinLoadServiceDef.commands.extractDocgen, 'handler');
    onTestFinished(() => {
      handlerSpy.mockRestore();
    });

    setDelegatedMode(true);
    const service = registerService(thinLoadServiceDef);

    const promise = service.queries.docgen.loaded({ id: 'button' });

    await vi.waitFor(() => expect(emittedCalls(channel, SERVICE_COMMAND_INVOKE)).toHaveLength(1));

    const invoke = emittedCalls(channel, SERVICE_COMMAND_INVOKE)[0][1] as CommandInvokePayload;
    expect(invoke).toMatchObject({
      serviceId: thinLoadServiceDef.id,
      commandName: 'extractDocgen',
      input: { id: 'button' },
    });

    channel.emitExternal(SERVICE_COMMAND_ACK, {
      serviceId: thinLoadServiceDef.id,
      callId: invoke.callId,
      clientId: 'peer',
    });
    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: thinLoadServiceDef.id,
      state: { components: { button: 'extracted-on-peer' } },
      version: 1,
      clientId: 'peer',
    });
    channel.emitExternal(SERVICE_COMMAND_RESULT, {
      serviceId: thinLoadServiceDef.id,
      callId: invoke.callId,
      result: 'extracted-on-peer',
      clientId: 'peer',
    });

    await expect(promise).resolves.toBe('extracted-on-peer');
    expect(handlerSpy).not.toHaveBeenCalled();
    expect(service.queries.docgen.get({ id: 'button' })).toBe('extracted-on-peer');
  });
});
