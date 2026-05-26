import * as v from 'valibot';
import { describe, expectTypeOf, it } from 'vitest';

import { createService, defineService } from './index.ts';

type OpenServiceState = {
  count: number;
  valuesById: Record<string, string | undefined>;
};

const entryIdInputSchema = v.object({ entryId: v.string() });
const incrementInputSchema = v.number();

const openServiceDef = defineService({
  id: 'test/open-service-types',
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
        expectTypeOf(ctx.self.commands.increment).parameter(0).toEqualTypeOf<number>();
        expectTypeOf(ctx.self.commands.increment).returns.toEqualTypeOf<Promise<void>>();

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
        expectTypeOf(ctx.self.commands.preloadValue).parameter(0).toEqualTypeOf<{
          entryId: string;
        }>();
        expectTypeOf(ctx.self.commands.preloadValue).returns.toEqualTypeOf<Promise<void>>();

        return ctx.self.state.valuesById[input.entryId] ?? null;
      },
      preload: async (input, ctx) => {
        expectTypeOf(input).toEqualTypeOf<{ entryId: string }>();
        await ctx.self.commands.preloadValue(input);

        // @ts-expect-error preloadValue requires an entryId object
        await ctx.self.commands.preloadValue({ entryId: 1 });
      },
      static: {
        path: (input, ctx) => {
          expectTypeOf(input).toEqualTypeOf<{ entryId: string }>();
          expectTypeOf(ctx.self.commands.preloadValue).parameter(0).toEqualTypeOf<{
            entryId: string;
          }>();

          return `${input.entryId}.json`;
        },
        inputs: (ctx) => {
          expectTypeOf(ctx.self.state).toEqualTypeOf<OpenServiceState>();
          return [{ entryId: 'entry-a' }];
        },
      },
    },
  },
  commands: {
    increment: {
      input: incrementInputSchema,
      output: v.void(),
      handler: (input, ctx) => {
        expectTypeOf(input).toEqualTypeOf<number>();
        ctx.self.setState((draft) => {
          expectTypeOf(draft).toEqualTypeOf<OpenServiceState>();
          draft.count += input;
        });
      },
    },
    preloadValue: {
      input: entryIdInputSchema,
      output: v.void(),
      handler: async (input, ctx) => {
        expectTypeOf(input).toEqualTypeOf<{ entryId: string }>();
        ctx.self.setState((draft) => {
          expectTypeOf(draft.valuesById[input.entryId]).toEqualTypeOf<string | undefined>();
          draft.valuesById[input.entryId] = 'ready';
        });
      },
    },
  },
});

const openService = createService(openServiceDef);

describe('open-service type inference', () => {
  it('infers runtime query and command signatures from inline schemas', () => {
    expectTypeOf(openService.queries.getCount).parameter(0).toEqualTypeOf<undefined>();
    expectTypeOf(openService.queries.getCount).returns.toEqualTypeOf<Promise<number>>();

    expectTypeOf(openService.queries.getValue).parameter(0).toEqualTypeOf<{
      entryId: string;
    }>();
    expectTypeOf(openService.queries.getValue).returns.toEqualTypeOf<Promise<string | null>>();

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
      id: 'test/invalid-open-service-types',
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
});