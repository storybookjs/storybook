import type {
  CommandDefinition,
  MatchingOutputSchemas,
  OperationInputSchemas,
  QueryDefinition,
  ServiceDefinition,
  ServiceId,
  ServiceState,
} from './types.ts';

type InvalidInternalOperationName<TName extends string> = {
  __internal_naming_error: `Operation "${TName}" has internal: true but must be prefixed with "_"`;
};

type InvalidUnderscoreWithoutInternal<TName extends string> = {
  __internal_naming_error: `Operation "${TName}" is prefixed with "_" and must set internal: true`;
};

type InternalOperationNaming<TKey> = TKey extends string
  ? TKey extends `_${string}`
    ? { internal: true } | InvalidUnderscoreWithoutInternal<TKey>
    : { internal?: false } | InvalidInternalOperationName<TKey>
  : {};

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
  > &
    InternalOperationNaming<TKey>;
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
  > &
    InternalOperationNaming<TKey>;
} & {
  [TKey in keyof TCommandOutputSchemas]: {
    output: TCommandOutputSchemas[TKey];
  };
};

/** Argument object shared by both `defineService` call forms. */
type ServiceDefinitionInput<
  TState,
  TQueryInputSchemas extends OperationInputSchemas,
  TQueryOutputSchemas extends MatchingOutputSchemas<TQueryInputSchemas>,
  TCommandInputSchemas extends OperationInputSchemas,
  TCommandOutputSchemas extends MatchingOutputSchemas<TCommandInputSchemas>,
> = {
  id: ServiceId;
  description?: string;
  internal?: boolean;
  initialState: ServiceState<TState>;
  queries: DefinedQueries<
    TState,
    TQueryInputSchemas,
    TQueryOutputSchemas,
    TCommandInputSchemas,
    TCommandOutputSchemas
  >;
  commands: DefinedCommands<TState, TCommandInputSchemas, TCommandOutputSchemas>;
};

/** Definition type produced from a `ServiceDefinitionInput`, shared by both call forms. */
type ResolvedServiceDefinition<
  TState,
  TQueryInputSchemas extends OperationInputSchemas,
  TQueryOutputSchemas extends MatchingOutputSchemas<TQueryInputSchemas>,
  TCommandInputSchemas extends OperationInputSchemas,
  TCommandOutputSchemas extends MatchingOutputSchemas<TCommandInputSchemas>,
> = ServiceDefinition<
  TState,
  DefinedQueries<
    TState,
    TQueryInputSchemas,
    TQueryOutputSchemas,
    TCommandInputSchemas,
    TCommandOutputSchemas
  >,
  DefinedCommands<TState, TCommandInputSchemas, TCommandOutputSchemas>
>;

/**
 * Direct form — infers state from `initialState` plus all schemas. Use when the initial value fully
 * conveys the state type.
 */
export function defineService<
  TState extends object,
  const TQueryInputSchemas extends OperationInputSchemas,
  const TQueryOutputSchemas extends MatchingOutputSchemas<TQueryInputSchemas>,
  const TCommandInputSchemas extends OperationInputSchemas,
  const TCommandOutputSchemas extends MatchingOutputSchemas<TCommandInputSchemas>,
>(
  def: ServiceDefinitionInput<
    TState,
    TQueryInputSchemas,
    TQueryOutputSchemas,
    TCommandInputSchemas,
    TCommandOutputSchemas
  >
): ResolvedServiceDefinition<
  TState,
  TQueryInputSchemas,
  TQueryOutputSchemas,
  TCommandInputSchemas,
  TCommandOutputSchemas
>;

/**
 * Curried form — `defineService<MyState>()(def)` pins the state type so `initialState` is checked
 * against it instead of cast. Use when the initial value can't convey the full type, e.g.
 * `{ items: {} }` that should be `Record<string, Item>`.
 */
export function defineService<TState extends object>(): <
  const TQueryInputSchemas extends OperationInputSchemas,
  const TQueryOutputSchemas extends MatchingOutputSchemas<TQueryInputSchemas>,
  const TCommandInputSchemas extends OperationInputSchemas,
  const TCommandOutputSchemas extends MatchingOutputSchemas<TCommandInputSchemas>,
>(
  def: ServiceDefinitionInput<
    TState,
    TQueryInputSchemas,
    TQueryOutputSchemas,
    TCommandInputSchemas,
    TCommandOutputSchemas
  >
) => ResolvedServiceDefinition<
  TState,
  TQueryInputSchemas,
  TQueryOutputSchemas,
  TCommandInputSchemas,
  TCommandOutputSchemas
>;

export function defineService(def?: unknown): unknown {
  // No arg = curried form: return the inner function.
  return def === undefined ? (innerDef: unknown) => innerDef : def;
}
