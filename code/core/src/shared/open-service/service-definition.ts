import type {
  AnySchema,
  CommandDefinition,
  Commands,
  Queries,
  QueryDefinition,
  ServiceDefinition,
} from './types.ts';

/**
 * Creates a strongly typed query-definition helper scoped to one service state shape.
 *
 * The curried form keeps `TState` explicit while letting the input and output schemas infer from
 * the provided definition object.
 */
export const defineQuery =
  <TState>() =>
  <TInputSchema extends AnySchema, TOutputSchema extends AnySchema>(
    def: QueryDefinition<TState, TInputSchema, TOutputSchema>
  ) =>
    def;

/** Creates a strongly typed command-definition helper scoped to one service state shape. */
export const defineCommand =
  <TState>() =>
  <TInputSchema extends AnySchema, TOutputSchema extends AnySchema>(
    def: CommandDefinition<TState, TInputSchema, TOutputSchema>
  ) =>
    def;

/** Finalizes a service definition while preserving the concrete query and command map types. */
export const defineService = <
  TState,
  TQueries extends Queries<TState>,
  TCommands extends Commands<TState>,
>(
  def: ServiceDefinition<TState, TQueries, TCommands>
) => def;
