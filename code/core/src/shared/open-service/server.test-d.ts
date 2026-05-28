import * as v from 'valibot';
import { describe, expectTypeOf, it } from 'vitest';

import { defineService } from './index.ts';
import { mutableRecordLookupServiceDef } from './fixtures.ts';
import { registerService } from './server.ts';
import type { RuntimeService } from './types.ts';

const entryIdInputSchema = v.object({ entryId: v.string() });

const registrationOnlyServiceDef = defineService({
  id: 'internal-fixture/open-service-registration-types',
  initialState: {
    count: 0,
    valuesById: {} as Record<string, string | undefined>,
  },
  queries: {
    getValue: {
      input: entryIdInputSchema,
      output: v.nullable(v.string()),
    },
  },
  commands: {
    increment: {
      input: v.number(),
      output: v.void(),
    },
    preloadValue: {
      input: entryIdInputSchema,
      output: v.void(),
    },
  },
});

const registeredService = registerService(registrationOnlyServiceDef, {
  queries: {
    getValue: {
      handler: (input, ctx) => {
        expectTypeOf(input).toEqualTypeOf<{ entryId: string }>();
        expectTypeOf(ctx.self.state.valuesById[input.entryId]).toEqualTypeOf<string | undefined>();
        // @ts-expect-error query handlers do not receive commands on self
        void ctx.self.commands;
        expectTypeOf(ctx.getService).parameter(0).toEqualTypeOf<string>();
        expectTypeOf(
          ctx.getService('internal-fixture/missing-service')
        ).toEqualTypeOf<RuntimeService>();

        return ctx.self.state.valuesById[input.entryId] ?? null;
      },
      load: async (input, ctx) => {
        expectTypeOf(input).toEqualTypeOf<{ entryId: string }>();
        expectTypeOf(ctx.self.commands.preloadValue).parameter(0).toEqualTypeOf<{
          entryId: string;
        }>();
        await ctx.self.commands.preloadValue(input);
      },
      static: {
        path: (input) => {
          expectTypeOf(input).toEqualTypeOf<{ entryId: string }>();
          return `${input.entryId}.json`;
        },
        inputs: () => [{ entryId: 'entry-a' }],
      },
    },
  },
  commands: {
    increment: {
      handler: (input, ctx) => {
        expectTypeOf(input).toEqualTypeOf<number>();
        ctx.self.setState((draft) => {
          draft.count += input;
        });
      },
    },
    preloadValue: {
      handler: async (input, ctx) => {
        expectTypeOf(input).toEqualTypeOf<{ entryId: string }>();
        ctx.self.setState((draft) => {
          draft.valuesById[input.entryId] = 'ready';
        });
      },
    },
  },
});

describe('open-service registration types', () => {
  it('infers registration overrides and the registered runtime surface', () => {
    expectTypeOf(registeredService.queries.getValue).parameter(0).toEqualTypeOf<{
      entryId: string;
    }>();
    expectTypeOf(registeredService.queries.getValue).returns.toEqualTypeOf<string | null>();
    expectTypeOf(registeredService.queries.getValue.loaded).returns.toEqualTypeOf<
      Promise<string | null>
    >();

    expectTypeOf(registeredService.commands.increment).parameter(0).toEqualTypeOf<number>();
    expectTypeOf(registeredService.commands.increment).returns.toEqualTypeOf<Promise<void>>();

    expectTypeOf(registeredService.commands.preloadValue).parameter(0).toEqualTypeOf<{
      entryId: string;
    }>();
    expectTypeOf(registeredService.getService).parameter(0).toEqualTypeOf<string>();
    expectTypeOf(
      registeredService.getService('internal-fixture/missing-service')
    ).toEqualTypeOf<RuntimeService>();
  });

  it('rejects invalid registration overrides', () => {
    registerService(registrationOnlyServiceDef, {
      queries: {
        getValue: {
          // @ts-expect-error query registration output must match the declared schema
          handler: () => 123,
        },
      },
    });

    registerService(registrationOnlyServiceDef, {
      commands: {
        preloadValue: {
          // @ts-expect-error command registration input must match the declared schema
          handler: async (input: { entryId: number }) => {
            void input;
          },
        },
      },
    });
  });

  it('types cross-service lookups when getService receives a definition generic', () => {
    registerService(mutableRecordLookupServiceDef);
    registerService(registrationOnlyServiceDef, {
      queries: {
        getValue: {
          handler: (_input, ctx) => {
            const lookup = ctx.getService<typeof mutableRecordLookupServiceDef>(
              'internal-fixture/mutable-record-lookup'
            );

            expectTypeOf(lookup.queries.getRecordFields).returns.toEqualTypeOf<Record<
              string,
              string
            > | null>();
            const missingService = ctx.getService('internal-fixture/missing-service');
            expectTypeOf(missingService).toEqualTypeOf<RuntimeService>();
            // @ts-expect-error getRecordFields requires an entryId string
            lookup.queries.getRecordFields({});

            return null;
          },
        },
      },
    });
  });
});
