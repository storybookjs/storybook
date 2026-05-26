import type {
  AbstractCommandDef,
  AnyCommandDef,
  AnyQueryDef,
  AnySchema,
  CommandDef,
  ConcreteCommandDef,
  QueryDef,
  ServiceDefinition,
} from './types.ts';

/**
 * Authoring helpers for service definitions.
 *
 * Recommended: `defineService<MyState>()(({ query, command }) => ({ id, state, queries, commands }))`.
 * The callback receives the `query` / `command` helpers, which provide per-entry inference for
 * `select` / `preload` / `path` / `handler` parameters and return types.
 *
 * Bare entries (without `query()` / `command()`) are accepted but only loosely validated; the
 * runtime still validates `input` / `output` schemas at call time.
 *
 * @example
 *
 * ```ts
 * const DocgenService = defineService<DocgenState>()(({ query, command }) => ({
 *   id: 'core/docgen',
 *   state: { byComponentId: {}, somethingElse: 42 },
 *   queries: {
 *     getComponentDocgenInfo: query({
 *       input: z.string(),
 *       output: componentDocgenSchema.nullable(),
 *       select: (state, componentId) => state.byComponentId[componentId] ?? null,
 *     }),
 *   },
 *   commands: {
 *     modifySomethingElse: command({
 *       input: z.void(),
 *       output: z.void(),
 *       handler: (ctx) => { ctx.self.setState((d) => { d.somethingElse = 1; }); },
 *     }),
 *   },
 * }));
 * ```
 */

// -------------------- result narrowing --------------------

type NarrowQueries<TState, Q> = {
  [K in keyof Q]: Q[K] extends QueryDef<TState, infer TIn, infer TOut>
    ? QueryDef<TState, TIn, TOut>
    : AnyQueryDef<TState>;
};

type NarrowCommands<TState, C> = {
  [K in keyof C]: C[K] extends CommandDef<TState, infer TIn, infer TOut>
    ? CommandDef<TState, TIn, TOut>
    : AnyCommandDef<TState>;
};

// -------------------- per-entry type helpers (runtime identity) --------------------

/**
 * Type-only helper for a query entry. At runtime this returns its argument unchanged.
 *
 * Required for inference: the object literal is checked as `QueryDef<TState, I, O>` directly,
 * which contextually types `select` / `preload` / `path` from `input` / `output`.
 */
export function query<TState>() {
  return <const I extends AnySchema, const O extends AnySchema>(
    definition: QueryDef<TState, I, O>
  ): QueryDef<TState, I, O> => definition;
}

/**
 * Type-only helper for a command entry. At runtime this returns its argument unchanged.
 *
 * Two overloads preserve the abstract/concrete distinction in the returned type:
 *   - With a `handler` field → {@link ConcreteCommandDef} (registration cannot override).
 *   - Without a `handler` field → {@link AbstractCommandDef} (registration must supply one).
 */
export function command<TState>(): {
  <const I extends AnySchema, const O extends AnySchema>(
    definition: ConcreteCommandDef<TState, I, O>
  ): ConcreteCommandDef<TState, I, O>;
  <const I extends AnySchema, const O extends AnySchema>(
    definition: AbstractCommandDef<TState, I, O>
  ): AbstractCommandDef<TState, I, O>;
};
export function command<TState>() {
  return (definition: CommandDef<TState>): CommandDef<TState> => definition;
}

/**
 * A command is **abstract** when its definition has no `handler` field. The runtime checks
 * for this at construction time and consults registration overrides if so.
 */
export function isAbstractCommand(entry: AnyCommandDef): boolean {
  return typeof entry.handler !== 'function';
}

export type QueryHelper<TState> = ReturnType<typeof query<TState>>;
export type CommandHelper<TState> = ReturnType<typeof command<TState>>;

export type ServiceAuthoringHelpers<TState> = {
  query: QueryHelper<TState>;
  command: CommandHelper<TState>;
};

/** The shape `setup` (or a bare object literal) must return. */
type SetupShape<TState, TId extends string, TQueries, TCommands> = {
  readonly id: TId;
  readonly description?: string;
  readonly state: TState;
  readonly queries: TQueries;
  readonly commands: TCommands;
};

type ResolvedServiceDef<TState, TQueries, TCommands> = ServiceDefinition<
  TState,
  NarrowQueries<TState, TQueries>,
  NarrowCommands<TState, TCommands>
>;

/**
 * Curried builder for an explicit-state service. Accepts either:
 *   - `({ query, command }) => ({ … })` — preferred; helpers drive per-entry inference.
 *   - A bare object literal `({ … })` — works when entry handlers carry explicit types.
 *
 * Bare entries are loosely validated by the `AnyQueryDef` / `AnyCommandDef` constraint;
 * wrap an entry with `query()` / `command()` for strict per-entry type checking.
 */
type DefineServiceBuilder<TState> = {
  <
    const TId extends string,
    const TQueries extends Record<string, AnyQueryDef<TState>>,
    const TCommands extends Record<string, AnyCommandDef<TState>>,
  >(
    setup: (
      helpers: ServiceAuthoringHelpers<TState>
    ) => SetupShape<TState, TId, TQueries, TCommands>
  ): ResolvedServiceDef<TState, TQueries, TCommands>;
  <
    const TId extends string,
    const TQueries extends Record<string, AnyQueryDef<TState>>,
    const TCommands extends Record<string, AnyCommandDef<TState>>,
  >(
    definition: SetupShape<TState, TId, TQueries, TCommands>
  ): ResolvedServiceDef<TState, TQueries, TCommands>;
};

/** Curried builder that infers state from the `state` field of the literal. */
type DefineServiceBuilderInferred = {
  <
    TState,
    const TId extends string,
    const TQueries extends Record<string, AnyQueryDef<TState>>,
    const TCommands extends Record<string, AnyCommandDef<TState>>,
  >(
    setup: (
      helpers: ServiceAuthoringHelpers<TState>
    ) => SetupShape<TState, TId, TQueries, TCommands>
  ): ResolvedServiceDef<TState, TQueries, TCommands>;
  <
    TState,
    const TId extends string,
    const TQueries extends Record<string, AnyQueryDef<TState>>,
    const TCommands extends Record<string, AnyCommandDef<TState>>,
  >(
    definition: SetupShape<TState, TId, TQueries, TCommands>
  ): ResolvedServiceDef<TState, TQueries, TCommands>;
};

const bindHelpers = <TState>(): ServiceAuthoringHelpers<TState> => ({
  query: query<TState>(),
  command: command<TState>(),
});

/**
 * Declare a service.
 *
 * - `defineService<State>()(({ query, command }) => ({ … }))` — preferred (callback form).
 * - `defineService<State>()({ … })` — bare object, explicit state.
 * - `defineService()(({ query, command }) => ({ … }))` — callback, state inferred from `state`.
 * - `defineService()({ … })` — bare object, state inferred from `state`.
 */
export function defineService(): DefineServiceBuilderInferred;
export function defineService<TState>(): DefineServiceBuilder<TState>;
export function defineService(): unknown {
  return (arg: unknown) => {
    if (typeof arg === 'function') {
      return (arg as (h: ServiceAuthoringHelpers<unknown>) => unknown)(bindHelpers());
    }
    return arg;
  };
}
