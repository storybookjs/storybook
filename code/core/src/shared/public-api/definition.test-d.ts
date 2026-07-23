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
      handler: async ({ name }, { consumer }) => {
        expectTypeOf(name).toEqualTypeOf<string>();
        expectTypeOf(consumer).toEqualTypeOf<ApiConsumer | undefined>();

        return `Hello ${name}`;
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
  });
});
