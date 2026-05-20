import type {
  AbstractCommand,
  BuildCtx,
  CommandsMap,
  LoaderDefinition,
  LoaderEnumerate,
  LoaderHandler,
  LoaderOptions,
  LoadersMap,
  QueriesMap,
  QueryDef,
  ServiceCtx,
  ServiceDefinition,
} from './types.ts';

/**
 * Authoring helper for a service definition.
 *
 * Two equivalent call forms:
 *
 *  - **Curried, explicit state** — `defineService<MyState>()({ ... })`. The state type is fixed
 *    by the outer generic; queries, commands, and loaders are inferred from the argument. Inside
 *    queries, `state` is typed as `MyState` automatically. Inside commands, `ctx` is typed as
 *    `ServiceCtx<MyState>` and `setState`'s draft is `MyState` — no per-handler annotations.
 *
 *  - **Inferred** — `defineService({ ... })`. State type is inferred from the `state:` literal.
 *    Queries still get contextual typing for `state`, but commands lose `ctx` typing because of
 *    contextual-typing limits over unions of function signatures, so command authors need to
 *    annotate `ctx: ServiceCtx<MyState>` themselves.
 *
 * The `load` map is keyed by query name — `load.foo` is the loader that backs `queries.foo`.
 *
 * @example
 *
 * ```ts
 * const DocgenService = defineService<DocgenState>()({
 *   id: 'core/docgen',
 *   state: { byComponentId: {}, somethingElse: 42 },
 *   queries: {
 *     getComponentDocgenInfo: (state, id: string) => state.byComponentId[id],
 *   },
 *   commands: {
 *     generateDocgen: defineCommand<string>(),
 *     bumpLocal: (ctx) => ctx.self.setState((d) => { d.somethingElse += 1 }),
 *   },
 *   load: { ... },
 * });
 * ```
 */
export function defineService<TState>(): <
  const TQueries extends QueriesMapFor<TState>,
  TCommands extends CommandsMapFor<TState>,
  const TLoaders extends LoadersMap<TState> = {},
>(definition: {
  id: string;
  state: TState;
  queries: TQueries;
  commands: TCommands;
  load?: TLoaders;
}) => ServiceDefinition<TState, TQueries, TCommands, TLoaders>;
export function defineService<
  TState,
  const TQueries extends QueriesMap<TState>,
  const TCommands extends CommandsMap<TState>,
  const TLoaders extends LoadersMap<TState> = {},
>(definition: {
  id: string;
  state: TState;
  queries: TQueries;
  commands: TCommands;
  load?: TLoaders;
}): ServiceDefinition<TState, TQueries, TCommands, TLoaders>;
export function defineService(definition?: unknown): unknown {
  if (definition === undefined) {
    // Curried form: return a function that takes the definition.
    return (def: unknown) => def;
  }
  return definition;
}

// -------------------- contextually-typed map shapes for the curried form --------------------

/**
 * The curried form binds `TState` outside the argument's type, so query/command/loader handlers
 * can be contextually typed against it. The constraints below mention `TState` so handler
 * parameters get the right types without per-handler annotations.
 *
 * Queries accept either the bare-function form or the object form. Both are typed against
 * `TState` so the selector's first parameter is inferred correctly.
 */
type QueriesMapFor<TState> = Record<
  string,
  ((state: TState, ...rest: any[]) => any) | QueryDefFor<TState>
>;

interface QueryDefFor<TState> {
  readonly select: (state: TState, ...rest: any[]) => any;
  readonly preload?: (...args: any[]) => void | Promise<void>;
  readonly inputs?:
    | readonly any[]
    | ((ctx: BuildCtx) => readonly any[] | Promise<readonly any[]>);
  readonly path?: (...args: any[]) => string;
}

/**
 * Function-overload-as-interface. TS contextual typing picks the overload that matches the
 * literal's arity: `(ctx) => …` binds against the 1-arg overload (ctx becomes `ServiceCtx<TState>`),
 * `(input, ctx) => …` binds against the 2-arg overload. A variadic-tuple union does NOT achieve
 * this — TS fails to discriminate and falls back to `any` for the parameter.
 */
interface CommandFnFor<TState> {
  (ctx: ServiceCtx<TState>): void | Promise<void>;
  (input: any, ctx: ServiceCtx<TState>): void | Promise<void>;
}

type CommandsMapFor<TState> = Record<string, CommandFnFor<TState> | AbstractCommand<any, any>>;

/**
 * Authoring helper for a loader.
 *
 * @param handler - side-effecting body. Typically calls one or more commands, which write to
 *   state via `setState`. The handler's return value is ignored — subscribers see the result
 *   the paired query selector produces once state has settled.
 * @param enumerateInputs - the set of inputs this loader should be pre-rendered for at build time.
 *   For zero-input loaders (single-file shape), pass `undefined`. For dynamic enumeration, pass
 *   a function (receives a `BuildCtx` so it can read other services in the future).
 * @param options - per-loader configuration. `path` controls the JSON filename emitted by the
 *   static build pipeline.
 */
export function defineLoader<TState, TInput = void>(
  handler: LoaderHandler<TState, TInput>,
  enumerateInputs: LoaderEnumerate<TInput>,
  options: LoaderOptions<TInput> = {}
): LoaderDefinition<TState, TInput> {
  return {
    __kind: 'loader',
    handler,
    enumerateInputs,
    options,
  };
}

/**
 * Authoring helper for a query.
 *
 * Two ways to declare a query in a service definition:
 *
 *  - As a bare selector: `getFoo: (state, id: string) => state.byId[id]`. No preload, no
 *    static build artifact. Most queries look like this.
 *  - As an object: `getFoo: defineQuery({ select, preload?, inputs?, path? })`. Reach for this
 *    when the query needs read-triggered population (`preload`), build-time pre-rendering
 *    (`inputs`, `path`), or both.
 *
 * `defineQuery` itself is a pass-through; it exists for type inference and authoring clarity.
 */
export function defineQuery<TState, TDef extends QueryDef<TState>>(def: TDef): TDef {
  return def;
}

/**
 * Authoring helper for a command.
 *
 * Two forms:
 *
 *  - **Abstract** — `defineCommand<TInput>()`. Declares that the service has a command of this
 *    input type, but leaves the implementation to be supplied at registration. Useful when the
 *    same service definition runs in multiple environments (manager, preview, server) with
 *    environment-specific bodies, or when the body depends on environment-only modules.
 *
 *  - **Concrete** — `defineCommand((input, ctx) => …)`. Just a pass-through; equivalent to
 *    putting the function in the commands map directly. Provided for symmetry.
 *
 * Concrete commands written inline as plain functions also work — `defineCommand` is only
 * required when you want an abstract declaration.
 */
export function defineCommand<TInput = void, TOutput = void>(): AbstractCommand<TInput, TOutput>;
export function defineCommand<TInput, TOutput = void>(
  handler: [TInput] extends [void]
    ? (ctx: ServiceCtx<any>) => TOutput | Promise<TOutput>
    : (input: TInput, ctx: ServiceCtx<any>) => TOutput | Promise<TOutput>
): typeof handler;
export function defineCommand(
  handler?: (...args: any[]) => any
): AbstractCommand<any, any> | ((...args: any[]) => any) {
  if (handler) return handler;
  return { __kind: 'abstract-command' };
}

/**
 * Runtime predicate: is this command entry an abstract declaration?
 * Used internally by the runtime to know whether a registration-time handler is required.
 */
export function isAbstractCommand(entry: unknown): entry is AbstractCommand<any, any> {
  return (
    typeof entry === 'object' &&
    entry !== null &&
    (entry as { __kind?: string }).__kind === 'abstract-command'
  );
}
