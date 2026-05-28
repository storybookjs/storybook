import * as v from 'valibot';
import { afterEach, describe, expect, it } from 'vitest';

import { defineService } from './service-definition.ts';
import {
  assignEntryFieldInputSchema,
  entryIdInputSchema,
  mutableRecordLookupServiceDef,
  recordFieldsOutputSchema,
  voidOutputSchema,
} from './fixtures.ts';
import {
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

    expect(getService('test/mutable-record-lookup')).toBe(service);
    expect(getRegisteredServices()).toHaveLength(1);
    await expect(listServices()).resolves.toEqual([
      {
        id: 'internal-fixture/mutable-record-lookup',
        description: 'Provides a mutable record lookup keyed by entry id.',
        queryNames: ['getRecordFields'],
        commandNames: ['assignRecordField'],
      },
    ]);

    const descriptor = await describeService('test/mutable-record-lookup');

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
        message: 'A service with id "test/mutable-record-lookup" is already registered.',
      });
    }
  });

  it('throws a Storybook error when resolving a missing registered service id', () => {
    expect(() => getService('test/missing-service')).toThrow(
      'No registered service with id "test/missing-service" exists in this environment.'
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
      'Query "test/unimplemented-operations.getValue" is not implemented for this environment.'
    );
    await expect(service.commands.run(undefined)).rejects.toMatchObject({
      fromStorybook: true,
      code: 8,
      message:
        'Command "test/unimplemented-operations.run" is not implemented for this environment.',
    });
  });

  it('lets handlers resolve another registered service by id through ctx.getService', async () => {
    const derivedServiceDef = defineService({
      id: 'internal-fixture/derived-boolean-from-service-id',
      description: 'Derives marker state by resolving another service through ctx.getService.',
      initialState: {} as Record<string, never>,
      queries: {
        isEntryMarked: {
          description: 'Returns whether the lookup service reports marker=match for an entry.',
          input: entryIdInputSchema,
          output: v.boolean(),
          handler: (input, ctx) => {
            const sourceService = ctx.getService('test/mutable-record-lookup');
            const record = sourceService.queries.getRecordFields({
              entryId: input.entryId,
            }) as Record<string, string> | null;

            return record?.marker === 'match';
          },
        },
      },
      commands: {},
    });

    const sourceService = registerService(mutableRecordLookupServiceDef);
    const derivedService = registerService(derivedServiceDef);

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
            ctx.self.setState((draft) => {
              draft.count += 1;
            });
          },
        },
        assignFromLookup: {
          handler: async (input, ctx) => {
            const lookup = ctx.getService('test/mutable-record-lookup');

            await lookup.commands.assignRecordField(input);

            const record = lookup.queries.getRecordFields({
              entryId: input.entryId,
            }) as Record<string, string> | null;
            ctx.self.setState((draft) => {
              draft.count = record?.marker === input.fieldValue ? 1 : 0;
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
      getService('test/mutable-record-lookup').queries.getRecordFields({
        entryId: 'entry-a',
      })
    ).toEqual({ marker: 'match' });
  });
});
