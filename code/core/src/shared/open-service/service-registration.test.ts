import { afterEach, describe, expect, it } from 'vitest';

import {
  awaitedPreloadValueServiceDef,
  assignEntryFieldInputSchema,
  createDerivedBooleanFromChildQueryServiceDef,
  entryIdInputSchema,
  hiddenServiceDef,
  internalStaticBuildServiceDef,
  mixedVisibilityServiceDef,
  mutableRecordLookupServiceDef,
  recordFieldsOutputSchema,
  registeredCommandOverrideServiceDef,
  registrationOnlyStaticBuildServiceDef,
  unimplementedOperationsServiceDef,
  voidOutputSchema,
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
        queryNames: ['getRecordFields'],
        commandNames: ['assignRecordField'],
      },
    ]);

    const descriptor = await describeService('internal-fixture/mutable-record-lookup');

    expect(descriptor).toMatchObject({
      id: 'internal-fixture/mutable-record-lookup',
      description: 'Provides a mutable record lookup keyed by entry id.',
      queries: {
        getRecordFields: {
          name: 'getRecordFields',
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
    expect(descriptor.queries.getRecordFields.input).toBe(entryIdInputSchema);
    expect(descriptor.queries.getRecordFields.output).toBe(recordFieldsOutputSchema);
    expect(descriptor.queries.getRecordFields.staticPath).toBeUndefined();
    expect(descriptor.commands.assignRecordField.input).toBe(assignEntryFieldInputSchema);
    expect(descriptor.commands.assignRecordField.output).toBe(voidOutputSchema);
  });

  it('throws when registering the same service id twice', () => {
    registerService(mutableRecordLookupServiceDef);

    try {
      registerService(mutableRecordLookupServiceDef);
      expect.unreachable('Expected duplicate registration to throw');
    } catch (error) {
      expect(error).toMatchObject({
        fromStorybook: true,
        code: 6,
        message:
          'A service with id "internal-fixture/mutable-record-lookup" is already registered.',
      });
    }
  });

  it('throws a Storybook error when resolving a missing registered service id', () => {
    expect(() => getService('internal-fixture/missing-service')).toThrow(
      'No registered service with id "internal-fixture/missing-service" exists in this environment.'
    );
  });

  it('throws a Storybook error when a registered query or command is missing its handler', async () => {
    const service = registerService(unimplementedOperationsServiceDef);

    expect(() => service.queries.getValue(undefined)).toThrow(
      'Query "internal-fixture/unimplemented-operations.getValue" is not implemented for this environment.'
    );
    await expect(service.commands.run(undefined)).rejects.toMatchObject({
      fromStorybook: true,
      code: 8,
      message:
        'Command "internal-fixture/unimplemented-operations.run" is not implemented for this environment.',
    });
  });

  it('lets handlers resolve another registered service by id through ctx.getService', async () => {
    const sourceService = registerService(mutableRecordLookupServiceDef);
    const derivedService = registerService(createDerivedBooleanFromChildQueryServiceDef());

    expect(derivedService.queries.isEntryMarked({ entryId: 'entry-a' })).toBe(false);

    await sourceService.commands.assignRecordField({
      entryId: 'entry-a',
      fieldKey: 'marker',
      fieldValue: 'match',
    });

    expect(derivedService.queries.isEntryMarked({ entryId: 'entry-a' })).toBe(true);
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
            const lookup = ctx.getService<typeof mutableRecordLookupServiceDef>(
              'internal-fixture/mutable-record-lookup'
            );

            await lookup.commands.assignRecordField(input);

            const record = lookup.queries.getRecordFields({
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
    expect(service.queries.getCount(undefined)).toBe(1);

    await service.commands.assignFromLookup({
      entryId: 'entry-a',
      fieldKey: 'marker',
      fieldValue: 'match',
    });
    expect(service.queries.getCount(undefined)).toBe(1);

    expect(
      getService('internal-fixture/mutable-record-lookup').queries.getRecordFields({
        entryId: 'entry-a',
      })
    ).toEqual({ marker: 'match' });
  });

  it('exposes staticPath presence on query descriptors', async () => {
    registerService(awaitedPreloadValueServiceDef);

    const descriptor = await describeService('internal-fixture/awaited-preload-value');

    expect(descriptor.queries.getPreloadedValue.staticPath).toBe(true);
  });

  it('allows load and staticInputs to be supplied only at registration time', async () => {
    registerService(registrationOnlyStaticBuildServiceDef, {
      queries: {
        getValue: {
          load: async (_input, ctx) => {
            await ctx.self.commands.setValue(undefined);
          },
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
      getService('internal-fixture/registration-only-static-build').queries.getValue({
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
        queryNames: ['getValue'],
        commandNames: ['setValue'],
      },
    ]);

    const descriptor = await describeService('internal-fixture/mixed-visibility');

    expect(Object.keys(descriptor.queries)).toEqual(['getValue']);
    expect(Object.keys(descriptor.commands)).toEqual(['setValue']);

    expect(service.queries._getInternalValue(undefined)).toBe(0);
    await service.commands._reset(undefined);
    expect(service.queries.getValue(undefined)).toBe(0);
  });

  it('omits internal services from listServices while keeping runtime access', async () => {
    registerService(mutableRecordLookupServiceDef);
    registerService(hiddenServiceDef);

    await expect(listServices()).resolves.toEqual([
      {
        id: 'internal-fixture/mutable-record-lookup',
        description: 'Provides a mutable record lookup keyed by entry id.',
        queryNames: ['getRecordFields'],
        commandNames: ['assignRecordField'],
      },
    ]);

    const descriptor = await describeService('internal-fixture/hidden-service');

    expect(descriptor).toMatchObject({
      id: 'internal-fixture/hidden-service',
      description: 'Hidden from listServices.',
      queries: {
        getSecret: {
          name: 'getSecret',
          description: 'Returns the secret flag.',
        },
      },
      commands: {},
    });

    expect(getService('internal-fixture/hidden-service').queries.getSecret(undefined)).toBe(true);
  });

  it('still builds static snapshots for internal queries', async () => {
    registerService(internalStaticBuildServiceDef, {
      queries: {
        _getValue: {
          load: async (_input, ctx) => {
            await ctx.self.commands._setValue(undefined);
          },
        },
      },
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
