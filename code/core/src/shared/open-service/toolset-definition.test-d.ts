import * as v from 'valibot';
import { describe, expectTypeOf, it } from 'vitest';

import { defineToolset, type ToolsetDefinition } from './index.ts';

const exampleToolset = defineToolset({
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

const reviewToolset = defineToolset({
  id: 'review',
  description: 'Create a review',
  methods: {
    create: {
      description: 'Create a review',
      schema: v.object({ title: v.string() }),
      handler: async (input, ctx) => {
        expectTypeOf(input.title).toEqualTypeOf<string>();
        expectTypeOf(ctx.consumer).toEqualTypeOf<'cli' | 'mcp'>();
        expectTypeOf(ctx.origin).toEqualTypeOf<string | undefined>();
        expectTypeOf(ctx.format).toEqualTypeOf<'markdown' | 'json'>();
        expectTypeOf(
          ctx.getService<{ ok: true }>('core/review', { internal: true })
        ).toEqualTypeOf<{
          ok: true;
        }>();

        return input.title;
      },
    },
  },
});

describe('defineToolset types', () => {
  it('preserves method schema output types in handlers', () => {
    expectTypeOf(exampleToolset).toMatchTypeOf<ToolsetDefinition>();
    expectTypeOf(exampleToolset.methods.greet.handler).parameter(0).toEqualTypeOf<{
      name: string;
    }>();
    expectTypeOf(reviewToolset.methods.create.handler).parameter(0).toEqualTypeOf<{
      title: string;
    }>();
  });
});
