import type {
  CommandDefinition,
  MatchingOutputSchemas,
  OperationInputSchemas,
  QueryDefinition,
  ServiceDefinition,
  ServiceId,
  ServiceState,
} from './types.ts';

/**
 * Authoring-side query map derived from separate query input/output schema maps.
 *
 * The second mapped-type intersection is deliberate. During experiments, TypeScript would infer
 * the `input` schema for each inline query, but then lose the corresponding `output` schema before
 * it contextually typed sibling callbacks. Repeating the output map through a keyed `output` view
 * keeps each query key's input and output schemas correlated while handlers, load hooks, and
 * static callbacks are being typed.
 */
type DefinedQueries<
  TState,
  TQueryInputSchemas extends OperationInputSchemas,
  TQueryOutputSchemas extends MatchingOutputSchemas<TQueryInputSchemas>,
  TCommandInputSchemas extends OperationInputSchemas,
  TCommandOutputSchemas extends MatchingOutputSchemas<TCommandInputSchemas>,
> = {
  [TKey in keyof TQueryInputSchemas]: QueryDefinition<
    TState,
    TQueryInputSchemas[TKey],
    TQueryOutputSchemas[TKey],
    TCommandInputSchemas,
    TCommandOutputSchemas
  >;
} & {
  [TKey in keyof TQueryOutputSchemas]: {
    output: TQueryOutputSchemas[TKey];
  };
};

/**
 * Authoring-side command map derived from separate command input/output schema maps.
 *
 * Commands do not need access to the command schema maps in their own context, but they still
 * benefit from the same key-correlation trick as queries so TypeScript preserves each inline
 * command object's `output` schema while typing its `handler`.
 */
type DefinedCommands<
  TState,
  TCommandInputSchemas extends OperationInputSchemas,
  TCommandOutputSchemas extends MatchingOutputSchemas<TCommandInputSchemas>,
> = {
  [TKey in keyof TCommandInputSchemas]: CommandDefinition<
    TState,
    TCommandInputSchemas[TKey],
    TCommandOutputSchemas[TKey]
  >;
} & {
  [TKey in keyof TCommandOutputSchemas]: {
    output: TCommandOutputSchemas[TKey];
  };
};

/**
 * Finalizes a service definition while preserving inline query and command inference.
 *
 * The generic order matters here. We infer the per-operation schema maps first, then derive the
 * concrete query/command definition maps from those schemas. If we instead ask TypeScript to infer
 * the full runtime `ServiceDefinition` maps directly, it widens callback parameters to `unknown`
 * before it has correlated each inline object's `input` and `output` properties.
 */
export const defineService = <
  // `extends object` rejects primitives, `null`, and `undefined` (while still accepting both
  // `interface` and `type` state shapes); `ServiceState` additionally rejects arrays. State must be a
  // plain object — see `ServiceState` for the deep-signal / deep-reconcile reasons.
  TState extends object,
  const TQueryInputSchemas extends OperationInputSchemas,
  const TQueryOutputSchemas extends MatchingOutputSchemas<TQueryInputSchemas>,
  const TCommandInputSchemas extends OperationInputSchemas,
  const TCommandOutputSchemas extends MatchingOutputSchemas<TCommandInputSchemas>,
>(def: {
  id: ServiceId;
  description?: string;
  initialState: ServiceState<TState>;
  queries: DefinedQueries<
    TState,
    TQueryInputSchemas,
    TQueryOutputSchemas,
    TCommandInputSchemas,
    TCommandOutputSchemas
  >;
  commands: DefinedCommands<TState, TCommandInputSchemas, TCommandOutputSchemas>;
}): ServiceDefinition<
  TState,
  DefinedQueries<
    TState,
    TQueryInputSchemas,
    TQueryOutputSchemas,
    TCommandInputSchemas,
    TCommandOutputSchemas
  >,
  DefinedCommands<TState, TCommandInputSchemas, TCommandOutputSchemas>
> => def;
