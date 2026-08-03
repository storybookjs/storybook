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
  telemetryGroup: 'dev',
  methods: {
    greet: {
      description: 'Greets a person.',
      schema: v.object({ name: v.string() }),
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
  telemetryGroup: 'dev',
  methods: {
    create: {
      description: (ctx) => `Create a review (${ctx.consumer})`,
      schema: v.object({ title: v.string() }),
      outputSchema: v.object({ title: v.string() }),
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
      { consumer: 'cli', getService: () => ({}) as never }
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

describe('schema-bound outcomes', () => {
  // `reviewToolset` above is the acceptance case: its success data carries `origin`, which the
  // output schema does not declare — outcome data may be a superset of the published contract.

  it('rejects data that renames a schema-declared field', () => {
    defineToolset({
      id: 'renamed-field',
      description: 'Rejected',
      telemetryGroup: 'dev',
      methods: {
        create: {
          description: 'Renames title to heading.',
          schema: v.object({}),
          outputSchema: v.object({ title: v.string() }),
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
      telemetryGroup: 'dev',
      methods: {
        create: {
          description: 'Publishes title but returns nothing.',
          schema: v.object({}),
          outputSchema: v.object({ title: v.string() }),
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
      telemetryGroup: 'dev',
      methods: {
        create: {
          description: 'Returns a number where the schema declares a string.',
          schema: v.object({}),
          outputSchema: v.object({ title: v.string() }),
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
      telemetryGroup: 'dev',
      methods: {
        create: {
          description: 'Failure data skips the published contract.',
          schema: v.object({}),
          outputSchema: v.object({ title: v.string() }),
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
});
