import * as v from 'valibot';
import { describe, expectTypeOf, it } from 'vitest';

import {
  defineToolset,
  type ToolsetCtx,
  type ToolsetDefinition,
  type ToolsetOutcome,
} from './index.ts';

const exampleToolset = defineToolset({
  id: 'example',
  description: 'Example API',
  methods: {
    greet: {
      title: 'Greet',
      description: 'Greets a person.',
      input: v.object({ name: v.string() }),
      handler: async ({ name }): Promise<ToolsetOutcome<{ greeting: string }, never>> => ({
        ok: true,
        data: { greeting: `Hello ${name}` },
        markdown: `Hello ${name}`,
      }),
    },
  },
});

const reviewToolset = defineToolset({
  id: 'review',
  description: 'Create a review',
  methods: {
    create: {
      title: 'Create review',
      description: (ctx) => `Create a review (${ctx.transport})`,
      input: v.object({ title: v.string() }),
      output: v.object({ title: v.string() }),
      handler: async (
        input,
        ctx
      ): Promise<
        ToolsetOutcome<{ title: string; origin?: string }, { title: string; reason: string }>
      > =>
        input.title
          ? { ok: true, data: { title: input.title, origin: ctx.origin }, markdown: input.title }
          : {
              ok: false,
              data: { title: input.title, reason: 'missing title' },
              markdown: 'missing title',
            },
    },
  },
});

describe('defineToolset types', () => {
  // Assertions live outside the definition literal: inside it, the first contextual-typing pass
  // sees `any`/`unknown` params, so exact-type checks there would report on the wrong pass.
  it('types handler input from the method schema', () => {
    const greet: (
      input: { name: string },
      context: ToolsetCtx
    ) => Promise<ToolsetOutcome<{ greeting: string }, never>> =
      exampleToolset.methods.greet.handler;
    const create: (
      input: { title: string },
      context: ToolsetCtx
    ) => Promise<
      ToolsetOutcome<{ title: string; origin?: string }, { title: string; reason: string }>
    > = reviewToolset.methods.create.handler;

    expectTypeOf(greet).toBeFunction();
    expectTypeOf(create).toBeFunction();
    expectTypeOf(exampleToolset).toMatchTypeOf<ToolsetDefinition>();
  });

  it('narrows both branches of an outcome on its tag', async () => {
    const outcome = await reviewToolset.methods.create.handler(
      { title: 'x' },
      { transport: 'cli', getService: () => ({}) as never }
    );

    if (outcome.ok) {
      expectTypeOf(outcome.data).toEqualTypeOf<{ title: string; origin?: string }>();
    } else {
      expectTypeOf(outcome.data).toEqualTypeOf<{ title: string; reason: string }>();
    }
  });

  it('makes the failure branch unreachable for infallible methods', async () => {
    const outcome = await exampleToolset.methods.greet.handler({ name: 'x' });

    if (!outcome.ok) {
      expectTypeOf(outcome.data).toBeNever();
    }
  });

  it('resolves description functions against the toolset context', () => {
    const description: string | ((context: ToolsetCtx) => string) =
      reviewToolset.methods.create.description;

    expectTypeOf(description).not.toBeNever();
  });
});

describe('method titles', () => {
  it('rejects a method that omits its display title', () => {
    defineToolset({
      id: 'untitled',
      description: 'Rejected',
      methods: {
        // @ts-expect-error — every method must declare its display `title`
        create: {
          description: 'Has no title.',
          input: v.object({}),
          handler: async (): Promise<ToolsetOutcome<{ done: boolean }, never>> => ({
            ok: true,
            data: { done: true },
            markdown: 'x',
          }),
        },
      },
    });
  });
});

describe('schema-bound outcomes', () => {
  // `reviewToolset` above is the acceptance case: its success data carries `origin`, which the
  // output schema does not declare — outcome data may be a superset of the published contract.

  it('rejects data that renames a schema-declared field', () => {
    defineToolset({
      id: 'renamed-field',
      description: 'Rejected',
      methods: {
        create: {
          title: 'Create',
          description: 'Renames title to heading.',
          input: v.object({}),
          output: v.object({ title: v.string() }),
          // @ts-expect-error — `data` lacks the schema-declared `title` field
          handler: async (): Promise<ToolsetOutcome<{ heading: string }, never>> => ({
            ok: true,
            data: { heading: 'x' },
            markdown: 'x',
          }),
        },
      },
    });
  });

  it('rejects data that drops a schema-declared field', () => {
    defineToolset({
      id: 'dropped-field',
      description: 'Rejected',
      methods: {
        create: {
          title: 'Create',
          description: 'Publishes title but returns nothing.',
          input: v.object({}),
          output: v.object({ title: v.string() }),
          // @ts-expect-error — `data` is missing the schema-declared `title` field
          handler: async (): Promise<ToolsetOutcome<Record<string, never>, never>> => ({
            ok: true,
            data: {},
            markdown: 'x',
          }),
        },
      },
    });
  });

  it('rejects data that mistypes a schema-declared field', () => {
    defineToolset({
      id: 'mistyped-field',
      description: 'Rejected',
      methods: {
        create: {
          title: 'Create',
          description: 'Returns a number where the schema declares a string.',
          input: v.object({}),
          output: v.object({ title: v.string() }),
          // @ts-expect-error — `title` is a number where the schema declares a string
          handler: async (): Promise<ToolsetOutcome<{ title: number }, never>> => ({
            ok: true,
            data: { title: 1 },
            markdown: 'x',
          }),
        },
      },
    });
  });

  it('constrains the failure branch to the schema too', () => {
    defineToolset({
      id: 'unbound-failure',
      description: 'Rejected',
      methods: {
        create: {
          title: 'Create',
          description: 'Failure data skips the published contract.',
          input: v.object({}),
          output: v.object({ title: v.string() }),
          // @ts-expect-error — failure `data` lacks the schema-declared `title` field
          handler: async (): Promise<ToolsetOutcome<{ title: string }, { reason: string }>> => ({
            ok: false,
            data: { reason: 'x' },
            markdown: 'x',
          }),
        },
      },
    });
  });

  it('rejects scalar output schemas', () => {
    defineToolset({
      id: 'scalar-output',
      description: 'Rejected',
      methods: {
        create: {
          title: 'Create',
          description: 'Scalars are not MCP structuredContent.',
          input: v.object({}),
          // @ts-expect-error — output must describe a JSON object
          output: v.string(),
          handler: async (): Promise<ToolsetOutcome<{ title: string }, never>> => ({
            ok: true,
            data: { title: 'x' },
            markdown: 'x',
          }),
        },
      },
    });
  });

  it('rejects array output schemas', () => {
    defineToolset({
      id: 'array-output',
      description: 'Rejected',
      methods: {
        create: {
          title: 'Create',
          description: 'Arrays are not MCP structuredContent.',
          input: v.object({}),
          // @ts-expect-error — output must describe a JSON object
          output: v.array(v.string()),
          handler: async (): Promise<ToolsetOutcome<{ title: string }, never>> => ({
            ok: true,
            data: { title: 'x' },
            markdown: 'x',
          }),
        },
      },
    });
  });
});
