import * as v from 'valibot';
import { describe, expectTypeOf, it } from 'vitest';

import { defineApi, type ApiConsumer, type ApiDefinition } from './index.ts';

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
  description: 'Review API',
  methods: {
    create: {
      description: 'Creates a review.',
      schema: v.object({ storyIds: v.array(v.string()) }),
      handler: async ({ storyIds }, { consumer }) => {
        expectTypeOf(storyIds).toEqualTypeOf<string[]>();
        expectTypeOf(consumer).toEqualTypeOf<ApiConsumer | undefined>();

        return storyIds.join(',');
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
      storyIds: string[];
    }>();
  });
});
