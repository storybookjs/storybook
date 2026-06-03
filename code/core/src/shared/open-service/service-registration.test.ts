import * as v from 'valibot';
import { afterEach, describe, expect, it } from 'vitest';

import { defineService } from './service-definition.ts';
import {
  assignEntryFieldInputSchema,
  awaitedPreloadValueServiceDef,
  createDerivedBooleanFromChildQueryServiceDef,
  entryIdInputSchema,
  mutableRecordLookupServiceDef,
  recordFieldsOutputSchema,
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
    const service = registerService(
      defineService({
        id: 'internal-fixture/unimplemented-operations',
        description: 'Leaves handlers undefined so registration can supply them later.',
        initialState: {} as Record<string, never>,
        queries: {
          getValue: {
            description: 'Reads a value that is not implemented in this environment.',
            input: v.undefined(),
            output: v.string(),
          },
        },
        commands: {
          run: {
            description: 'Runs a command that is not implemented in this environment.',
            input: v.undefined(),
            output: voidOutputSchema,
          },
        },
      })
    );

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
    const incrementableServiceDef = defineService({
      id: 'internal-fixture/registered-command-override',
      description: 'Provides a command handler at registration time.',
      initialState: { count: 0 },
      queries: {
        getCount: {
          description: 'Reads the current count.',
          input: v.undefined(),
          output: v.number(),
          handler: (_input, ctx) => ctx.self.state.count,
        },
      },
      commands: {
        increment: {
          description: 'Increments the current count.',
          input: v.undefined(),
          output: voidOutputSchema,
        },
        assignFromLookup: {
          description: 'Reads another service and mirrors whether a marker exists.',
          input: assignEntryFieldInputSchema,
          output: voidOutputSchema,
        },
      },
    });

    registerService(mutableRecordLookupServiceDef);
    const service = registerService(incrementableServiceDef, {
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
    const serviceDef = defineService({
      id: 'internal-fixture/registration-only-static-build',
      description: 'Declares staticPath in the definition and load at registration.',
      initialState: { value: null as string | null },
      queries: {
        getValue: {
          description: 'Returns one statically built value.',
          input: v.object({ build: v.literal('once') }),
          output: v.nullable(v.string()),
          handler: (_input, ctx) => ctx.self.state.value,
          staticPath: () => 'state.json',
          staticInputs: async () => [{ build: 'once' as const }],
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
});
