import * as v from 'valibot';

import { defineService } from './service-definition.ts';

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
/** Shared schema for nullable string payloads used by load-oriented fixtures. */
export const preloadedValueOutputSchema = v.nullable(v.string());
export const noInputSchema = v.void();
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
  id: 'internal-fixture/mutable-record-lookup',
  description: 'Provides a mutable record lookup keyed by entry id.',
  initialState: {} as MutableRecordState,
  queries: {
    getRecordFields: {
      description: 'Returns all stored fields for one entry, or null when absent.',
      input: entryIdInputSchema,
      output: recordFieldsOutputSchema,
      handler: (input, ctx) => ctx.self.state[input.entryId] ?? null,
    },
  },
  commands: {
    assignRecordField: {
      description: 'Writes one field value onto the selected entry.',
      input: assignEntryFieldInputSchema,
      output: voidOutputSchema,
      handler: (input, ctx) => {
        ctx.self.setState((draft) => {
          draft[input.entryId] ??= {};
          draft[input.entryId]![input.fieldKey] = input.fieldValue;
        });
      },
    },
  },
});

export type PreloadedValueState = Record<string, string | undefined>;

/** Service fixture that loads state from a command before returning it. */
export const awaitedPreloadValueServiceDef = defineService({
  id: 'internal-fixture/awaited-preload-value',
  description: 'Loads a value on demand via a command and reads it back from state.',
  initialState: {} as PreloadedValueState,
  queries: {
    getPreloadedValue: {
      description: 'Returns the value for an entry; load triggers a command to populate state.',
      input: entryIdInputSchema,
      output: preloadedValueOutputSchema,
      handler: (input, ctx) => ctx.self.state[input.entryId] ?? null,
      load: (input, ctx) => {
        if (!(input.entryId in ctx.self.state)) {
          return ctx.self.commands.preloadValue(input).then(() => undefined);
        }
      },
      static: {
        inputs: async () => [{ entryId: 'entry-a' }, { entryId: 'entry-b' }],
      },
    },
  },
  commands: {
    preloadValue: {
      description: 'Loads a deterministic value for one entry id.',
      input: entryIdInputSchema,
      output: voidOutputSchema,
      handler: async (input, ctx) => {
        await Promise.resolve();
        ctx.self.setState((draft) => {
          draft[input.entryId] = 'preloaded';
        });
      },
    },
  },
});

/** Service fixture that starts load work in the background and returns immediately. */
export const fireAndForgetPreloadValueServiceDef = defineService({
  id: 'internal-fixture/fire-and-forget-preload-value',
  description: 'Loads a value in the background without awaiting it.',
  initialState: {} as PreloadedValueState,
  queries: {
    getPreloadedValue: {
      description:
        'Returns the current value; load fires a command in the background when missing.',
      input: entryIdInputSchema,
      output: preloadedValueOutputSchema,
      handler: (input, ctx) => ctx.self.state[input.entryId] ?? null,
      load: (input, ctx) => {
        if (!(input.entryId in ctx.self.state)) {
          void ctx.self.commands.preloadValue(input);
        }
      },
    },
  },
  commands: {
    preloadValue: {
      description: 'Loads a deterministic value for one entry id.',
      input: entryIdInputSchema,
      output: voidOutputSchema,
      handler: async (input, ctx) => {
        await Promise.resolve();
        ctx.self.setState((draft) => {
          draft[input.entryId] = 'preloaded';
        });
      },
    },
  },
});

export type SharedStaticFileState = { left?: string; right?: string };

/** Creates a fixture where multiple queries contribute state to one shared static file. */
export function createSharedStaticFileServiceDef() {
  return defineService({
    id: 'internal-fixture/shared-static-file',
    description: 'Builds two independent query outputs into one shared static file.',
    initialState: {} as SharedStaticFileState,
    queries: {
      getLeftValue: {
        description: 'Loads the left value into the shared file state.',
        input: noInputSchema,
        output: preloadedValueOutputSchema,
        handler: (_input, ctx) => ctx.self.state.left ?? null,
        load: async (_input, ctx) => {
          await ctx.self.commands.writeLeftValue(undefined);
        },
        static: {
          path: () => 'shared.json',
          inputs: async () => [undefined],
        },
      },
      getRightValue: {
        description: 'Loads the right value into the shared file state.',
        input: noInputSchema,
        output: preloadedValueOutputSchema,
        handler: (_input, ctx) => ctx.self.state.right ?? null,
        load: async (_input, ctx) => {
          await ctx.self.commands.writeRightValue(undefined);
        },
        static: {
          path: () => 'shared.json',
          inputs: async () => [undefined],
        },
      },
    },
    commands: {
      writeLeftValue: {
        description: 'Writes the left static value into state.',
        input: noInputSchema,
        output: voidOutputSchema,
        handler: (_input, ctx) => {
          ctx.self.setState((draft) => {
            draft.left = 'preloaded';
          });
        },
      },
      writeRightValue: {
        description: 'Writes the right static value into state.',
        input: noInputSchema,
        output: voidOutputSchema,
        handler: (_input, ctx) => {
          ctx.self.setState((draft) => {
            draft.right = 'preloaded';
          });
        },
      },
    },
  });
}

/**
 * Creates a service that composes one service's query inside another service's query.
 *
 * The derived service resolves the source service through `ctx.getService(...)` at call time —
 * the same lookup any consumer code would use — rather than capturing the registered instance in
 * a closure. The source service must already be registered when the derived query runs.
 */
export function createDerivedBooleanFromChildQueryServiceDef() {
  type DerivedState = Record<string, never>;

  return defineService({
    id: 'internal-fixture/derived-boolean-from-child-query',
    description: 'Derives a boolean from the child lookup query.',
    initialState: {} as DerivedState,
    queries: {
      isEntryMarked: {
        description: 'Returns whether the child query reports marker=match for an entry.',
        input: entryIdInputSchema,
        output: booleanOutputSchema,
        handler: (input, ctx) => {
          const source = ctx.getService<typeof mutableRecordLookupServiceDef>(
            mutableRecordLookupServiceDef.id
          );
          const record = source.queries.getRecordFields({
            entryId: input.entryId,
          });

          return record?.marker === 'match';
        },
      },
    },
    commands: {},
  });
}

/** Creates a fixture that intentionally returns an invalid query output. */
export function createInvalidQueryOutputServiceDef() {
  return defineService({
    id: 'internal-fixture/invalid-query-output',
    description: 'Returns an invalid query output on purpose.',
    initialState: {} as Record<string, never>,
    queries: {
      getBrokenValue: {
        description: 'Returns a string-shaped output that is actually a number.',
        input: noInputSchema,
        output: preloadedValueOutputSchema,
        handler: () => 42 as unknown as string | null,
      },
    },
    commands: {},
  });
}

/** Creates a fixture that intentionally returns an invalid command output. */
export function createInvalidCommandOutputServiceDef() {
  return defineService({
    id: 'internal-fixture/invalid-command-output',
    description: 'Returns an invalid command output on purpose.',
    initialState: {} as Record<string, never>,
    queries: {},
    commands: {
      runBrokenCommand: {
        description: 'Returns a string-shaped output that is actually a number.',
        input: noInputSchema,
        output: v.string(),
        handler: () => 42 as unknown as string,
      },
    },
  });
}

/** Creates a fixture that intentionally yields invalid static load inputs. */
export function createInvalidStaticInputServiceDef() {
  return defineService({
    id: 'internal-fixture/invalid-static-input',
    description: 'Provides an invalid static load input on purpose.',
    initialState: {} as PreloadedValueState,
    queries: {
      getPreloadedValue: {
        description: 'Validates static inputs before load runs.',
        input: entryIdInputSchema,
        output: preloadedValueOutputSchema,
        handler: (input, ctx) => ctx.self.state[input.entryId] ?? null,
        load: async () => {},
        static: {
          inputs: async () => [{} as unknown as { entryId: string }],
        },
      },
    },
    commands: {},
  });
}
