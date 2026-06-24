import * as v from 'valibot';
import { describe, expectTypeOf, it } from 'vitest';

import { defineService } from './index.ts';
import { type MutableRecordLookupService, mutableRecordLookupServiceDef } from './fixtures.ts';
import { getService, registerService } from './server.ts';
import type { RuntimeService } from './types.ts';

const entryIdInputSchema = v.object({ entryId: v.string() });

const registrationOnlyServiceDef = defineService({
  id: 'internal-fixture/open-service-registration-types',
  initialState: {
    count: 0,
    valuesById: {} as Record<string, string | undefined>,
  },
  queries: {
    value: {
      input: entryIdInputSchema,
      output: v.nullable(v.string()),
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
        await ctx.self.commands.preloadValue(input);
      },
      staticPath: (input) => {
        expectTypeOf(input).toEqualTypeOf<{ entryId: string }>();
        return `${input.entryId}.json`;
      },
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
    value: {
      staticInputs: () => [{ entryId: 'entry-a' }],
    },
  },
  commands: {
    increment: {
      handler: (input, ctx) => {
        expectTypeOf(input).toEqualTypeOf<number>();
        ctx.self.setState((state) => {
          state.count += input;
        });
      },
    },
    preloadValue: {
      handler: async (input, ctx) => {
        expectTypeOf(input).toEqualTypeOf<{ entryId: string }>();
        ctx.self.setState((state) => {
          state.valuesById[input.entryId] = 'ready';
        });
      },
    },
  },
});

describe('open-service registration types', () => {
  it('infers registration overrides and the registered runtime surface', () => {
    expectTypeOf(registeredService.queries.value.get).parameter(0).toEqualTypeOf<{
      entryId: string;
    }>();
    expectTypeOf(registeredService.queries.value.get).returns.toEqualTypeOf<string | null>();
    expectTypeOf(registeredService.queries.value.loaded).returns.toEqualTypeOf<
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
        value: {
          // @ts-expect-error query handlers belong on the definition, not at registration
          handler: () => 'wrong',
        },
      },
    });

    registerService(registrationOnlyServiceDef, {
      queries: {
        value: {
          // @ts-expect-error load must be declared on the definition, not at registration
          load: async () => {},
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

  it('types cross-service lookups when getService receives an instance generic', () => {
    registerService(mutableRecordLookupServiceDef);
    registerService(
      defineService({
        id: 'internal-fixture/open-service-registration-cross-service',
        initialState: { valuesById: {} as Record<string, string | undefined> },
        queries: {
          value: {
            input: entryIdInputSchema,
            output: v.nullable(v.string()),
            handler: (_input, ctx) => {
              const lookup = ctx.getService<MutableRecordLookupService>(
                'internal-fixture/mutable-record-lookup'
              );

              expectTypeOf(lookup.queries.recordFields.get).returns.toEqualTypeOf<Record<
                string,
                string
              > | null>();
              const missingService = ctx.getService('internal-fixture/missing-service');
              expectTypeOf(missingService).toEqualTypeOf<RuntimeService>();
              // @ts-expect-error recordFields requires an entryId string
              lookup.queries.recordFields.get({});

              return null;
            },
          },
        },
        commands: {},
      })
    );
  });
});

describe('typed core getService (server)', () => {
  it('types known core service ids without an explicit generic', () => {
    expectTypeOf(getService('core/docgen').queries.docgen.get).parameter(0).toEqualTypeOf<{
      id: string;
    }>();
    expectTypeOf(getService('core/story-docs').queries.storyDocs.get).parameter(0).toEqualTypeOf<{
      id: string;
    }>();
    expectTypeOf(
      getService('core/module-graph').queries.latestStoryChanges.subscribe
    ).toBeFunction();
  });

  it('falls back to RuntimeService for unknown ids', () => {
    expectTypeOf(getService('addon-docs/mdx')).toEqualTypeOf<RuntimeService>();
  });

  it('honors an explicit generic over a known core id', () => {
    expectTypeOf(getService<RuntimeService>('core/docgen')).toEqualTypeOf<RuntimeService>();
  });
});
