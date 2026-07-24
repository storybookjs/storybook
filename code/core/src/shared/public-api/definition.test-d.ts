import * as v from 'valibot';
import { describe, expectTypeOf, it } from 'vitest';

import { defineApi, type ApiDefinition } from './index.ts';

const exampleApi = defineApi({
  id: 'example',
  description: 'Example API',
  methods: {
    greet: {
      description: 'Greets a person.',
      schema: v.object({ name: v.string() }),
      handler: async ({ name }) => {
        expectTypeOf(name).toEqualTypeOf<string>();

        return `Hello ${name}`;
      },
    },
  },
});

const reviewApi = defineApi({
  id: 'review',
  description: 'Create a review',
  methods: {
    create: {
      description: 'Create a review',
      schema: v.object({ title: v.string() }),
      handler: async (input, ctx) => {
        expectTypeOf(input.title).toEqualTypeOf<string>();
        expectTypeOf(ctx.consumer).toEqualTypeOf<'cli' | 'mcp'>();
        expectTypeOf(ctx.origin).toEqualTypeOf<string>();
        expectTypeOf(ctx.getService('core/review')).not.toBeAny();

        return input.title;
      },
    },
  },
});

describe('defineApi types', () => {
  it('preserves method schema output types in handlers', () => {
    expectTypeOf(exampleApi).toMatchTypeOf<ApiDefinition>();
    expectTypeOf(exampleApi.methods.greet.handler).parameter(0).toEqualTypeOf<{
      name: string;
    }>();
    expectTypeOf(reviewApi.methods.create.handler).parameter(0).toEqualTypeOf<{
      title: string;
    }>();
  });
});
