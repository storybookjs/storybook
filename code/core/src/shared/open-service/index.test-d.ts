import * as v from 'valibot';
import { describe, expectTypeOf, it } from 'vitest';

import { defineService } from './index.ts';
import { registerService } from './server.ts';

type OpenServiceState = {
  count: number;
  valuesById: Record<string, string | undefined>;
};

const entryIdInputSchema = v.object({ entryId: v.string() });
const incrementInputSchema = v.number();

const openServiceDef = defineService({
  id: 'internal-fixture/open-service-types',
  initialState: {
    count: 0,
    valuesById: {} as Record<string, string | undefined>,
  },
  queries: {
    getCount: {
      input: v.undefined(),
      output: v.number(),
      handler: (input, ctx) => {
        expectTypeOf(input).toEqualTypeOf<undefined>();
        expectTypeOf(ctx.self.state).toEqualTypeOf<OpenServiceState>();
        // @ts-expect-error query handlers do not receive commands on self
        void ctx.self.commands;
        // @ts-expect-error queries only receive a read-only self handle
        ctx.self.setState(() => {});

        return ctx.self.state.count;
      },
    },
    getValue: {
      input: entryIdInputSchema,
      output: v.nullable(v.string()),
      handler: (input, ctx) => {
        expectTypeOf(input).toEqualTypeOf<{ entryId: string }>();
        // @ts-expect-error query handlers do not receive commands on self
        void ctx.self.commands;

        return ctx.self.state.valuesById[input.entryId] ?? null;
      },
      load: async (input, ctx) => {
        expectTypeOf(input).toEqualTypeOf<{ entryId: string }>();
        expectTypeOf(ctx.self.commands.preloadValue).parameter(0).toEqualTypeOf<{
          entryId: string;
        }>();
        expectTypeOf(ctx.self.commands.preloadValue).returns.toEqualTypeOf<Promise<void>>();
        await ctx.self.commands.preloadValue(input);

        // @ts-expect-error preloadValue requires an entryId object
        await ctx.self.commands.preloadValue({ entryId: 1 });
        // @ts-expect-error load contexts do not receive setState directly
        ctx.self.setState(() => {});
      },
      staticPath: (input) => {
        expectTypeOf(input).toEqualTypeOf<{ entryId: string }>();
        return `${input.entryId}.json`;
      },
      staticInputs: () => [{ entryId: 'entry-a' }],
    },
  },
  commands: {
    increment: {
      input: incrementInputSchema,
      output: v.void(),
      handler: (input, ctx) => {
        expectTypeOf(input).toEqualTypeOf<number>();
        ctx.self.setState((state) => {
          expectTypeOf(state).toEqualTypeOf<OpenServiceState>();
          state.count += input;
        });
      },
    },
    preloadValue: {
      input: entryIdInputSchema,
      output: v.void(),
      handler: async (input, ctx) => {
        expectTypeOf(input).toEqualTypeOf<{ entryId: string }>();
        ctx.self.setState((state) => {
          expectTypeOf(state.valuesById[input.entryId]).toEqualTypeOf<string | undefined>();
          state.valuesById[input.entryId] = 'ready';
        });
      },
    },
  },
});

const openService = registerService(openServiceDef);

describe('open-service type inference', () => {
  it('infers runtime query and command signatures from inline schemas', () => {
    expectTypeOf(openService.queries.getCount).parameter(0).toEqualTypeOf<undefined>();
    expectTypeOf(openService.queries.getCount).returns.toEqualTypeOf<number>();
    expectTypeOf(openService.queries.getCount.loaded).returns.toEqualTypeOf<Promise<number>>();

    const voidService = registerService(
      defineService({
        id: 'internal-fixture/void-query-types',
        initialState: {},
        queries: {
          getAll: {
            input: v.void(),
            output: v.number(),
            handler: () => 1,
          },
        },
        commands: {},
      })
    );
    expectTypeOf(voidService.queries.getAll).returns.toEqualTypeOf<number>();
    expectTypeOf(voidService.queries.getAll()).toEqualTypeOf<number>();
    expectTypeOf(voidService.queries.getAll.loaded()).toEqualTypeOf<Promise<number>>();

    expectTypeOf(openService.queries.getValue).parameter(0).toEqualTypeOf<{
      entryId: string;
    }>();
    expectTypeOf(openService.queries.getValue).returns.toEqualTypeOf<string | null>();
    expectTypeOf(openService.queries.getValue.loaded).returns.toEqualTypeOf<
      Promise<string | null>
    >();

    expectTypeOf(openService.commands.increment).parameter(0).toEqualTypeOf<number>();
    expectTypeOf(openService.commands.increment).returns.toEqualTypeOf<Promise<void>>();

    expectTypeOf(openService.commands.preloadValue).parameter(0).toEqualTypeOf<{
      entryId: string;
    }>();
    expectTypeOf(openService.commands.preloadValue).returns.toEqualTypeOf<Promise<void>>();
  });

  it('rejects invalid runtime call signatures', () => {
    // @ts-expect-error getValue requires an entryId string
    openService.queries.getValue({});

    // @ts-expect-error increment requires a numeric payload
    openService.commands.increment(undefined);
  });

  it('rejects handlers that do not match the declared schemas', () => {
    defineService({
      id: 'internal-fixture/invalid-open-service-types',
      initialState: {} as Record<string, never>,
      queries: {
        getBrokenValue: {
          input: v.undefined(),
          output: v.number(),
          // @ts-expect-error query handler output must match the output schema input type
          handler: () => 'wrong',
        },
      },
      commands: {},
    });
  });

  it('rejects dependency-aware staticInputs on the definition layer', () => {
    defineService({
      id: 'internal-fixture/invalid-definition-static-inputs',
      initialState: {} as OpenServiceState,
      queries: {
        getValue: {
          input: entryIdInputSchema,
          output: v.nullable(v.string()),
          staticPath: () => 'value.json',
          // @ts-expect-error definition staticInputs cannot depend on load context
          staticInputs: (_ctx) => [{ entryId: 'entry-a' }],
        },
      },
      commands: {},
    });
  });
});
