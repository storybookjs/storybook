import * as v from 'valibot';

import { defineCommand, defineQuery, defineService } from './service-definition.ts';

/** Shared schema used by fixtures that address one logical record by id. */
export const entryIdInputSchema = v.object({ entryId: v.string() });
/** Shared schema used by fixtures that write one named field on one record. */
export const assignEntryFieldInputSchema = v.object({
  entryId: v.string(),
  fieldKey: v.string(),
  fieldValue: v.string(),
});
/** Shared schema for nullable record payloads returned from lookup queries. */
export const recordFieldsOutputSchema = v.nullable(v.record(v.string(), v.string()));
/** Shared schema for nullable string payloads used by preload-oriented fixtures. */
export const preloadedValueOutputSchema = v.nullable(v.string());
export const noInputSchema = v.undefined();
export const voidOutputSchema = v.void();
export const booleanOutputSchema = v.boolean();

export type MutableRecordState = Record<string, Record<string, string> | undefined>;

/**
 * Baseline service fixture used by most runtime and validation tests.
 *
 * It models a simple mutable lookup table so tests can focus on open-service behavior rather than
 * domain-specific logic.
 */
export const mutableRecordLookupServiceDef = defineService({
  id: 'test/mutable-record-lookup',
  description: 'Provides a mutable record lookup keyed by entry id.',
  initialState: {} as MutableRecordState,
  queries: {
    getRecordFields: defineQuery<MutableRecordState>()({
      description: 'Returns all stored fields for one entry, or null when absent.',
      input: entryIdInputSchema,
      output: recordFieldsOutputSchema,
      handler: (input, ctx) => ctx.self.state[input.entryId] ?? null,
    }),
  },
  commands: {
    assignRecordField: defineCommand<MutableRecordState>()({
      description: 'Writes one field value onto the selected entry.',
      input: assignEntryFieldInputSchema,
      output: voidOutputSchema,
      handler: (input, ctx) => {
        ctx.self.setState((draft) => {
          draft[input.entryId] ??= {};
          draft[input.entryId]![input.fieldKey] = input.fieldValue;
        });
      },
    }),
  },
});

export type PreloadedValueState = Record<string, string | undefined>;

/** Service fixture that awaits preload before resolving a query. */
export const awaitedPreloadValueServiceDef = defineService({
  id: 'test/awaited-preload-value',
  description: 'Preloads a value on demand and awaits preload before returning it.',
  initialState: {} as PreloadedValueState,
  queries: {
    getPreloadedValue: defineQuery<PreloadedValueState>()({
      description: 'Returns the value for an entry and preloads it first when missing.',
      input: entryIdInputSchema,
      output: preloadedValueOutputSchema,
      handler: (input, ctx) => ctx.self.state[input.entryId] ?? null,
      preload: (input, ctx) => {
        if (!(input.entryId in ctx.self.state)) {
          return ctx.self.commands.preloadValue(input).then(() => undefined);
        }
      },
      static: {
        inputs: async () => [{ entryId: 'entry-a' }, { entryId: 'entry-b' }],
      },
    }),
  },
  commands: {
    preloadValue: defineCommand<PreloadedValueState>()({
      description: 'Preloads a deterministic value for one entry id.',
      input: entryIdInputSchema,
      output: voidOutputSchema,
      handler: async (input, ctx) => {
        await Promise.resolve();
        ctx.self.setState((draft) => {
          draft[input.entryId] = 'preloaded';
        });
      },
    }),
  },
});

/** Service fixture that starts preload work in the background and returns immediately. */
export const fireAndForgetPreloadValueServiceDef = defineService({
  id: 'test/fire-and-forget-preload-value',
  description: 'Preloads a value in the background without awaiting preload.',
  initialState: {} as PreloadedValueState,
  queries: {
    getPreloadedValue: defineQuery<PreloadedValueState>()({
      description: 'Returns the current value and triggers a background preload when missing.',
      input: entryIdInputSchema,
      output: preloadedValueOutputSchema,
      handler: (input, ctx) => ctx.self.state[input.entryId] ?? null,
      preload: (input, ctx) => {
        if (!(input.entryId in ctx.self.state)) {
          void ctx.self.commands.preloadValue(input);
        }
      },
    }),
  },
  commands: {
    preloadValue: defineCommand<PreloadedValueState>()({
      description: 'Preloads a deterministic value for one entry id.',
      input: entryIdInputSchema,
      output: voidOutputSchema,
      handler: async (input, ctx) => {
        await Promise.resolve();
        ctx.self.setState((draft) => {
          draft[input.entryId] = 'preloaded';
        });
      },
    }),
  },
});

export type SharedStaticFileState = { left?: string; right?: string };

/** Creates a fixture where multiple queries contribute state to one shared static file. */
export function createSharedStaticFileServiceDef() {
  return defineService({
    id: 'test/shared-static-file',
    description: 'Builds two independent query outputs into one shared static file.',
    initialState: {} as SharedStaticFileState,
    queries: {
      getLeftValue: defineQuery<SharedStaticFileState>()({
        description: 'Preloads the left value into the shared file state.',
        input: noInputSchema,
        output: preloadedValueOutputSchema,
        handler: (_input, ctx) => ctx.self.state.left ?? null,
        preload: async (_input, ctx) => {
          await ctx.self.commands.writeLeftValue(undefined);
        },
        static: {
          path: () => 'shared.json',
          inputs: async () => [undefined],
        },
      }),
      getRightValue: defineQuery<SharedStaticFileState>()({
        description: 'Preloads the right value into the shared file state.',
        input: noInputSchema,
        output: preloadedValueOutputSchema,
        handler: (_input, ctx) => ctx.self.state.right ?? null,
        preload: async (_input, ctx) => {
          await ctx.self.commands.writeRightValue(undefined);
        },
        static: {
          path: () => 'shared.json',
          inputs: async () => [undefined],
        },
      }),
    },
    commands: {
      writeLeftValue: defineCommand<SharedStaticFileState>()({
        description: 'Writes the left static value into state.',
        input: noInputSchema,
        output: voidOutputSchema,
        handler: (_input, ctx) => {
          ctx.self.setState((draft) => {
            draft.left = 'preloaded';
          });
        },
      }),
      writeRightValue: defineCommand<SharedStaticFileState>()({
        description: 'Writes the right static value into state.',
        input: noInputSchema,
        output: voidOutputSchema,
        handler: (_input, ctx) => {
          ctx.self.setState((draft) => {
            draft.right = 'preloaded';
          });
        },
      }),
    },
  });
}

/** Creates a service that composes one service's query inside another service's query. */
export function createDerivedBooleanFromChildQueryServiceDef() {
  type DerivedState = Record<string, never>;

  return defineService({
    id: 'test/derived-boolean-from-child-query',
    description: 'Derives a boolean from the child lookup query.',
    initialState: {} as DerivedState,
    queries: {
      isEntryMarked: defineQuery<DerivedState>()({
        description: 'Returns whether the child query reports marker=match for an entry.',
        input: entryIdInputSchema,
        output: booleanOutputSchema,
        handler: async (input, ctx) => {
          const sourceService = await ctx.getService('test/mutable-record-lookup');
          const record = (await sourceService.queries.getRecordFields({
            entryId: input.entryId,
          })) as Record<string, string> | null;

          return record?.marker === 'match';
        },
      }),
    },
    commands: {},
  });
}

/** Creates a fixture that intentionally returns an invalid query output. */
export function createInvalidQueryOutputServiceDef() {
  return defineService({
    id: 'test/invalid-query-output',
    description: 'Returns an invalid query output on purpose.',
    initialState: {} as Record<string, never>,
    queries: {
      getBrokenValue: defineQuery<Record<string, never>>()({
        description: 'Returns a string-shaped output that is actually a number.',
        input: noInputSchema,
        output: preloadedValueOutputSchema,
        handler: () => 42 as unknown as string | null,
      }),
    },
    commands: {},
  });
}

/** Creates a fixture that intentionally returns an invalid command output. */
export function createInvalidCommandOutputServiceDef() {
  return defineService({
    id: 'test/invalid-command-output',
    description: 'Returns an invalid command output on purpose.',
    initialState: {} as Record<string, never>,
    queries: {},
    commands: {
      runBrokenCommand: defineCommand<Record<string, never>>()({
        description: 'Returns a string-shaped output that is actually a number.',
        input: noInputSchema,
        output: v.string(),
        handler: () => 42 as unknown as string,
      }),
    },
  });
}

/** Creates a fixture that intentionally yields invalid static preload inputs. */
export function createInvalidStaticInputServiceDef() {
  return defineService({
    id: 'test/invalid-static-input',
    description: 'Provides an invalid static preload input on purpose.',
    initialState: {} as PreloadedValueState,
    queries: {
      getPreloadedValue: defineQuery<PreloadedValueState>()({
        description: 'Validates static inputs before preload runs.',
        input: entryIdInputSchema,
        output: preloadedValueOutputSchema,
        handler: (input, ctx) => ctx.self.state[input.entryId] ?? null,
        preload: async () => {},
        static: {
          inputs: async () => [{} as unknown as { entryId: string }],
        },
      }),
    },
    commands: {},
  });
}
