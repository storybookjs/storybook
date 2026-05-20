/**
 * Core type definitions for the Open Service Architecture.
 *
 * The architecture has four primitives:
 *  - **state**: a single in-memory object per service, *private* to the service. Only the
 *    service's own handlers can read or write it; consumers never see it directly.
 *  - **queries**: pure, synchronous selectors over state. The only read API. Side-effect free.
 *  - **commands**: write+read functions that mutate state via `ctx.self.setState`. Async OK.
 *    The only write API.
 *  - **loaders**: the read-triggered backing for a query. Statically buildable.
 *
 * A query and its loader share a name — `queries.getX` is backed by `load.getX`.
 *
 * Definition vs. registration:
 *  - A service *definition* declares the state shape, queries, commands, and loaders. Commands
 *    can be declared *abstractly* via `defineCommand<TInput>()` — no implementation yet.
 *  - At *registration* time, the abstract commands receive their implementations. Concrete
 *    commands from the definition can also be overridden.
 *
 * That split lets a single definition be imported into multiple environments (manager,
 * preview, server) with environment-specific command bodies, while keeping the shape (state,
 * queries, command signatures) shared.
 */

// -------------------- state mutation --------------------

/**
 * Mutate a draft of the state. Immer-backed: this is a real draft you can assign to, push to,
 * delete from, etc. The runtime captures the minimal patch list and applies it as a single
 * immutable transition.
 */
export type StateMutator<TState> = (draft: TState) => void;

// -------------------- command handlers --------------------

/**
 * A concrete command writes state via `ctx.self.setState`. May be async.
 * Either `(ctx)` (no input) or `(input, ctx)` (with input).
 */
export type CommandHandler<TState, TInput> = [TInput] extends [void]
  ? (ctx: ServiceCtx<TState>) => void | Promise<void>
  : (input: TInput, ctx: ServiceCtx<TState>) => void | Promise<void>;

/**
 * An abstract command — declared at definition time, implementation provided at registration.
 *
 * Carries phantom `TInput`/`TOutput` types so consumer-side `store.commands.foo(input)` calls
 * remain type-safe even though the body lives in the registration overrides.
 */
export interface AbstractCommand<TInput = void, TOutput = void> {
  readonly __kind: 'abstract-command';
  /** Phantom type slot. Never set at runtime. */
  readonly _input?: TInput;
  /** Phantom type slot. Never set at runtime. */
  readonly _output?: TOutput;
}

/** A command entry in the definition is either a concrete handler or an abstract marker. */
export type CommandEntry = ((...args: any[]) => any) | AbstractCommand<any, any>;

// -------------------- loader handlers --------------------

/**
 * A loader handler runs the side-effects required to populate state for a query. Typically it
 * calls one or more commands, which then write to state via `setState`. The loader's *return*
 * value is ignored — the result subscribers see is whatever the paired query selector returns
 * once state has settled.
 */
export type LoaderHandler<TState, TInput> = [TInput] extends [void]
  ? (ctx: ServiceCtx<TState>) => void | Promise<void>
  : (input: TInput, ctx: ServiceCtx<TState>) => void | Promise<void>;

// -------------------- loader definition + options --------------------

/**
 * Build-time context passed to loader enumeration and path callbacks.
 * Will grow to include `ctx.runtime[serviceId].queries.x()` so enumeration can read from
 * other services (e.g. the story index for docgen).
 */
export interface BuildCtx {
  readonly isBuild: true;
}

export type LoaderEnumerate<TInput> = [TInput] extends [void]
  ? undefined
  : readonly TInput[] | ((ctx: BuildCtx) => readonly TInput[] | Promise<readonly TInput[]>);

export type LoaderPath<TInput> = [TInput] extends [void]
  ? (ctx: BuildCtx) => string
  : (ctx: BuildCtx, input: TInput) => string;

export interface LoaderOptions<TInput> {
  /**
   * The filename (relative to the service's static build directory) where this loader's
   * artifact lives. Defaults: `<loaderName>.json` for no-input loaders, and
   * `<loaderName>-<input>.json` for string inputs. Non-string inputs (objects, numbers) must
   * supply this callback explicitly — there's no sensible default for arbitrary shapes.
   */
  path?: LoaderPath<TInput>;
}

export interface LoaderDefinition<TState, TInput> {
  readonly __kind: 'loader';
  readonly handler: LoaderHandler<TState, TInput>;
  readonly enumerateInputs: LoaderEnumerate<TInput>;
  readonly options: LoaderOptions<TInput>;
}

// -------------------- context handed to commands & loaders --------------------

/**
 * Runtime context handed to command and loader bodies.
 *
 * `ctx.self` exposes the running service's own state, setState, queries and commands.
 * Crucially, `ctx.self` is the ONLY way to touch state — there's no public state accessor
 * on the consumer-facing `ServiceStore`.
 */
export interface ServiceCtx<TState> {
  readonly self: SelfHandle<TState>;
}

export interface SelfHandle<TState> {
  /** Read the current state. Available only inside command/loader bodies. */
  getState(): TState;
  /**
   * Mutate state via an Immer draft. Available only inside command/loader bodies.
   *
   * The signature is inlined (rather than `mutator: StateMutator<TState>`) to give TypeScript
   * the most direct contextual-typing path: the draft argument of the inner lambda inherits
   * `TState` from the outer `ServiceCtx<TState>` without going through a type alias.
   */
  setState(mutator: (draft: TState) => void): void;
  /** Callable commands API on the service itself. Loose-typed inside the ctx. */
  readonly commands: Readonly<Record<string, (...args: any[]) => Promise<void>>>;
  /** Callable queries API on the service itself. */
  readonly queries: Readonly<Record<string, (...args: any[]) => any>>;
}

// -------------------- query entries --------------------

/**
 * A query entry in the definition is either a bare selector function or an object with extra
 * static-build metadata. Both forms are accepted; the object form is needed when the query
 * has a preload, enumerated inputs for build-time pre-rendering, or a custom path callback.
 *
 *   - Bare function: `(state, input?) => result`. Pure selector. No preload, no static artifact.
 *   - Object form: `{ select, preload?, inputs?, path? }`. The selector lives on `select`.
 */
export type QueryEntry<TState = any> =
  | ((state: TState, ...rest: any[]) => any)
  | QueryDef<TState>;

export interface QueryDef<TState = any> {
  /** Pure synchronous selector over state. Same contract as the bare-function form. */
  readonly select: (state: TState, ...rest: any[]) => any;
  /**
   * Optional read-triggered side effect that populates state for this query. Typically calls
   * one or more commands. The runtime fires it on first query subscription/read per input.
   * Skipped in static mode if a transport-fetched diff is available.
   */
  readonly preload?: (...args: any[]) => void | Promise<void>;
  /**
   * Optional enumeration of inputs the static build should pre-render. An array, an async
   * function returning an array, or `undefined` for no-input queries.
   */
  readonly inputs?:
    | readonly any[]
    | ((ctx: BuildCtx) => readonly any[] | Promise<readonly any[]>);
  /**
   * Optional filename for this query's per-input static artifact. If absent, the query has no
   * static artifact regardless of whether `inputs` is declared. Defaults follow the same rules
   * as the previous `LoaderOptions.path` — `<queryName>.json` for no-input, `<queryName>-<input>.json`
   * for string inputs.
   */
  readonly path?: (...args: any[]) => string;
}

// -------------------- service definition --------------------

/**
 * Map types used as constraints on `ServiceDefinition`. They're intentionally permissive — the
 * runtime detects arity from the selector's `length` and abstract commands from their `__kind`
 * marker, so the type system doesn't need to enforce signatures here. The curried
 * `defineService<S>()` form layers stricter shapes on top of these constraints to recover
 * contextual typing for `state` and `ctx`.
 */
export type QueriesMap<TState> = Record<string, QueryEntry<TState>>;
export type CommandsMap<TState> = Record<string, CommandEntry>;
export type LoadersMap<TState> = Record<string, LoaderDefinition<TState, any>>;

export interface ServiceDefinition<
  TState = unknown,
  TQueries extends QueriesMap<TState> = QueriesMap<TState>,
  TCommands extends CommandsMap<TState> = CommandsMap<TState>,
  TLoaders extends LoadersMap<TState> = LoadersMap<TState>,
> {
  /** Globally unique service id. Convention: `core/<name>` for built-ins, `<addonId>/<name>` for addons. */
  readonly id: string;
  /** Initial state. Used as the starting value of every runtime constructed from this definition. */
  readonly state: TState;
  readonly queries: TQueries;
  readonly commands: TCommands;
  /**
   * Optional loaders. A loader bridges a query to async work (typically: producing a JSON file
   * at build time, then fetching it lazily on the client). Services that don't declare loaders
   * have no static-build artifacts and no fetch on registration — their state is purely
   * session-local.
   */
  readonly load?: TLoaders;
}

// -------------------- registration --------------------

/**
 * Registration-time options. Provides handlers for abstract commands declared in the definition,
 * and lets you override concrete command handlers if the same definition is used in multiple
 * environments with environment-specific bodies.
 *
 * Note: there is no per-registration static transport. The architecture maintains a single
 * global transport (see `static-transport.ts`). Services never see or configure it.
 */
export interface ServiceRegistration<TDef extends ServiceDefinition<any, any, any, any>> {
  commands?: CommandOverrides<TDef>;
}

// `ServiceStaticTransport` lives in `static-transport.ts`. Re-export here for convenience of
// downstream importers that only reach for `./types.ts`.
export type { ServiceStaticTransport } from './static-transport.ts';

export type CommandOverrides<TDef extends ServiceDefinition<any, any, any, any>> = {
  [K in keyof TDef['commands']]?: TDef['commands'][K] extends AbstractCommand<infer I, infer O>
    ? [I] extends [void]
      ? (ctx: ServiceCtx<TDef['state']>) => O | Promise<O>
      : (input: I, ctx: ServiceCtx<TDef['state']>) => O | Promise<O>
    : (...args: any[]) => any;
};

// -------------------- input/output inference --------------------

/**
 * Param/return inference for queries and commands uses `Parameters<>` tuples so we can detect
 * actual arity. Plain `Q extends (state, input: infer I) => any` always succeeds for any function
 * because functions are contravariant in their parameters — `(a) => b` is a subtype of
 * `(a, c) => b`. The tuple form gives us the *declared* parameter list and lets us distinguish
 * 1-arg from 2-arg precisely.
 *
 * For queries, we additionally unwrap the object form `{ select, ... }` to look at `select`'s
 * signature. Both `(state, input) => result` and `{ select: (state, input) => result }` produce
 * the same input/output types.
 */
type SelectorOf<Q> = Q extends { select: infer S } ? S : Q;

type InputOfSelector<F> = F extends (...args: infer P) => any
  ? P extends readonly [any, infer I]
    ? I
    : void
  : void;

type OutputOfSelector<F> = F extends (state: any, ...args: any[]) => infer R ? R : never;

export type InputOfQuery<Q> = InputOfSelector<SelectorOf<Q>>;
export type OutputOfQuery<Q> = OutputOfSelector<SelectorOf<Q>>;

export type InputOfCommand<C> =
  C extends AbstractCommand<infer I, any>
    ? I
    : C extends (...args: infer P) => any
      ? P extends readonly [infer I, any]
        ? I
        : void
      : void;

export type OutputOfCommand<C> =
  C extends AbstractCommand<any, infer O>
    ? O
    : C extends (...args: any[]) => infer R
      ? Awaited<R>
      : void;

export type InputOfLoader<L> = L extends LoaderDefinition<any, infer I> ? I : never;

// -------------------- consumer-facing service handle --------------------

/** A subscribable query handle: callable for one-shot reads, plus a `.subscribe()` method. */
export type SubscribableQuery<TInput, TOutput> = [TInput] extends [void]
  ? {
      (): TOutput;
      subscribe(listener: (value: TOutput) => void): () => void;
    }
  : {
      (input: TInput): TOutput;
      subscribe(input: TInput, listener: (value: TOutput) => void): () => void;
    };

export type SubscribableQueries<TQ extends QueriesMap<any>> = {
  [K in keyof TQ]: SubscribableQuery<InputOfQuery<TQ[K]>, OutputOfQuery<TQ[K]>>;
};

export type CallableCommands<TC extends CommandsMap<any>> = {
  [K in keyof TC]: [InputOfCommand<TC[K]>] extends [void]
    ? () => Promise<void>
    : (input: InputOfCommand<TC[K]>) => Promise<void>;
};

/**
 * Public-facing handle returned by `registerService` / `getService`.
 *
 * State is *not* on this interface — it's internal to the service. To read data, call a query.
 * To change data, call a command. To react to changes, subscribe to a query.
 *
 * Infrastructure layers (the build pipeline) work against the `ServiceRuntime` class directly,
 * which exposes state-mutation hooks that aren't part of this public surface.
 */
export interface ServiceStore<TDef extends ServiceDefinition<any, any, any, any>> {
  readonly id: string;
  readonly definition: TDef;
  readonly queries: SubscribableQueries<TDef['queries']>;
  readonly commands: CallableCommands<TDef['commands']>;
}
