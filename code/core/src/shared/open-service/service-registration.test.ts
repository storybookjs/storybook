import * as v from 'valibot';
import { afterEach, describe, expect, it } from 'vitest';

import {
  assignEntryFieldInputSchema,
  awaitedPreloadValueServiceDef,
  createDerivedBooleanFromChildQueryServiceDef,
  entryIdInputSchema,
  hiddenServiceDef,
  internalStaticBuildServiceDef,
  mixedVisibilityServiceDef,
  mutableRecordLookupServiceDef,
  recordFieldsOutputSchema,
  registeredCommandOverrideServiceDef,
  voidOutputSchema,
  type MutableRecordLookupService,
} from './fixtures.ts';
import {
  buildStaticFiles,
  clearRegistry,
  describeService,
  getRegisteredServices,
  getService,
  listServices,
  registerService,
} from './server.ts';
import { defineService } from './service-definition.ts';

afterEach(() => {
  clearRegistry();
});

describe('service registration', () => {
  it('registers services globally and exposes summaries and descriptors by id', async () => {
    const service = registerService(mutableRecordLookupServiceDef);

    expect(getService('internal-fixture/mutable-record-lookup')).toBe(service);
    expect(getRegisteredServices()).toHaveLength(1);
    await expect(listServices()).resolves.toEqual([
      {
        id: 'internal-fixture/mutable-record-lookup',
        description: 'Provides a mutable record lookup keyed by entry id.',
        queryNames: ['recordFields'],
        commandNames: ['assignRecordField'],
      },
    ]);

    const descriptor = await describeService('internal-fixture/mutable-record-lookup');

    expect(descriptor).toMatchObject({
      id: 'internal-fixture/mutable-record-lookup',
      description: 'Provides a mutable record lookup keyed by entry id.',
      queries: {
        recordFields: {
          name: 'recordFields',
          description: 'Returns all stored fields for one entry, or null when absent.',
        },
      },
      commands: {
        assignRecordField: {
          name: 'assignRecordField',
          description: 'Writes one field value onto the selected entry.',
        },
      },
    });
    expect(descriptor.queries.recordFields.input).toBe(entryIdInputSchema);
    expect(descriptor.queries.recordFields.output).toBe(recordFieldsOutputSchema);
    expect(descriptor.queries.recordFields.staticPath).toBeUndefined();
    expect(descriptor.commands.assignRecordField.input).toBe(assignEntryFieldInputSchema);
    expect(descriptor.commands.assignRecordField.output).toBe(voidOutputSchema);
  });

  it('is idempotent by id: re-registering returns the existing instance instead of throwing', () => {
    const first = registerService(mutableRecordLookupServiceDef);
    const second = registerService(mutableRecordLookupServiceDef);

    expect(second).toBe(first);
    expect(getRegisteredServices()).toHaveLength(1);
  });

  it('throws a Storybook error when resolving a missing registered service id', () => {
    expect(() => getService('internal-fixture/missing-service')).toThrow(
      'No registered service with id "internal-fixture/missing-service" exists in this environment.'
    );
  });

  it('throws a Storybook error when a registered query is missing its handler', () => {
    // A command without a local handler does NOT throw here — it requests remote execution from a
    // peer that implements it (see service-command-transport.test.ts). Queries stay local-only.
    const service = registerService(
      defineService({
        id: 'internal-fixture/unimplemented-operations',
        description: 'Leaves the query handler undefined so registration can supply it later.',
        initialState: {} as Record<string, never>,
        queries: {
          value: {
            description: 'Reads a value that is not implemented in this environment.',
            input: v.undefined(),
            output: v.string(),
          },
        },
        commands: {},
      })
    );

    expect(() => service.queries.value.get(undefined)).toThrow(
      'Query "internal-fixture/unimplemented-operations.value" is not implemented for this environment.'
    );
  });

  it('lets handlers resolve another registered service by id through ctx.getService', async () => {
    const sourceService = registerService(mutableRecordLookupServiceDef);
    const derivedService = registerService(createDerivedBooleanFromChildQueryServiceDef());

    expect(derivedService.queries.isEntryMarked.get({ entryId: 'entry-a' })).toBe(false);

    await sourceService.commands.assignRecordField({
      entryId: 'entry-a',
      fieldKey: 'marker',
      fieldValue: 'match',
    });

    expect(derivedService.queries.isEntryMarked.get({ entryId: 'entry-a' })).toBe(true);
  });

  it('allows server registration to provide handlers that are omitted from the definition', async () => {
    registerService(mutableRecordLookupServiceDef);
    const service = registerService(registeredCommandOverrideServiceDef, {
      commands: {
        increment: {
          handler: async (_input, ctx) => {
            ctx.self.setState((state) => {
              state.count += 1;
            });
          },
        },
        assignFromLookup: {
          handler: async (input, ctx) => {
            const lookup = ctx.getService<MutableRecordLookupService>(
              'internal-fixture/mutable-record-lookup'
            );

            await lookup.commands.assignRecordField(input);

            const record = lookup.queries.recordFields.get({
              entryId: input.entryId,
            });
            ctx.self.setState((state) => {
              state.count = record?.marker === input.fieldValue ? 1 : 0;
            });
          },
        },
      },
    });

    await service.commands.increment(undefined);
    expect(service.queries.count.get(undefined)).toBe(1);

    await service.commands.assignFromLookup({
      entryId: 'entry-a',
      fieldKey: 'marker',
      fieldValue: 'match',
    });
    expect(service.queries.count.get(undefined)).toBe(1);

    expect(
      getService('internal-fixture/mutable-record-lookup').queries.recordFields.get({
        entryId: 'entry-a',
      })
    ).toEqual({ marker: 'match' });
  });

  it('exposes staticPath presence on query descriptors', async () => {
    registerService(awaitedPreloadValueServiceDef);

    const descriptor = await describeService('internal-fixture/awaited-preload-value');

    expect(descriptor.queries.preloadedValue.staticPath).toBe(true);
  });

  it('allows staticInputs to be supplied only at registration time', async () => {
    const serviceDef = defineService({
      id: 'internal-fixture/registration-only-static-build',
      description: 'Declares staticPath and load in the definition; staticInputs at registration.',
      initialState: { value: null as string | null },
      queries: {
        value: {
          description: 'Returns one statically built value.',
          input: v.object({ build: v.literal('once') }),
          output: v.nullable(v.string()),
          handler: (_input, ctx) => ctx.self.state.value,
          load: async (_input, ctx) => {
            await ctx.self.commands.setValue(undefined);
          },
          staticPath: () => 'state.json',
        },
      },
      commands: {
        setValue: {
          description: 'Stores one value during static load.',
          input: v.undefined(),
          output: voidOutputSchema,
        },
      },
    });

    registerService(serviceDef, {
      queries: {
        value: {
          staticInputs: async () => [{ build: 'once' as const }],
        },
      },
      commands: {
        setValue: {
          handler: async (_input, ctx) => {
            ctx.self.setState((state) => {
              state.value = 'built-at-registration';
            });
          },
        },
      },
    });

    await expect(buildStaticFiles()).resolves.toEqual({
      'internal-fixture/registration-only-static-build/state.json': {
        value: 'built-at-registration',
      },
    });

    expect(
      getService('internal-fixture/registration-only-static-build').queries.value.get({
        build: 'once',
      })
    ).toBe(null);
  });

  it('omits internal operations from describeService and listServices summaries', async () => {
    const service = registerService(mixedVisibilityServiceDef);

    await expect(listServices()).resolves.toEqual([
      {
        id: 'internal-fixture/mixed-visibility',
        description: 'Exposes one public and one internal operation per family.',
        queryNames: ['value'],
        commandNames: ['setValue'],
      },
    ]);

    const descriptor = await describeService('internal-fixture/mixed-visibility');

    expect(Object.keys(descriptor.queries)).toEqual(['value']);
    expect(Object.keys(descriptor.commands)).toEqual(['setValue']);

    expect(service.queries._internalValue.get(undefined)).toBe(0);
    await service.commands._reset(undefined);
    expect(service.queries.value.get(undefined)).toBe(0);
  });

  it('omits internal services from listServices while keeping runtime access', async () => {
    registerService(mutableRecordLookupServiceDef);
    registerService(hiddenServiceDef);

    await expect(listServices()).resolves.toEqual([
      {
        id: 'internal-fixture/mutable-record-lookup',
        description: 'Provides a mutable record lookup keyed by entry id.',
        queryNames: ['recordFields'],
        commandNames: ['assignRecordField'],
      },
    ]);

    const descriptor = await describeService('internal-fixture/hidden-service');

    expect(descriptor).toMatchObject({
      id: 'internal-fixture/hidden-service',
      description: 'Hidden from listServices.',
      queries: {
        secret: {
          name: 'secret',
          description: 'Returns the secret flag.',
        },
      },
      commands: {},
    });

    expect(getService('internal-fixture/hidden-service').queries.secret.get(undefined)).toBe(true);
  });

  it('still builds static snapshots for internal queries', async () => {
    registerService(internalStaticBuildServiceDef, {
      commands: {
        _setValue: {
          handler: async (_input, ctx) => {
            ctx.self.setState((draft) => {
              draft.value = 'built-internal';
            });
          },
        },
      },
    });

    await expect(buildStaticFiles()).resolves.toEqual({
      'internal-fixture/internal-static-build/state.json': {
        value: 'built-internal',
      },
    });
  });
});
