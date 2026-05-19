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

// -------------------- query handlers --------------------

/**
 * A query is a pure synchronous selector over state.
 * Either `(state) => output` (no input) or `(state, input) => output`.
 *
 * Hard rule: queries MUST NOT call commands, perform IO, or otherwise side-effect.
 * If a query needs to trigger loading, that lives in the paired `load.<name>` handler.
 */
export type QueryHandler<TState, TInput, TOutput> = [TInput] extends [void]
  ? (state: TState) => TOutput
  : (state: TState, input: TInput) => TOutput;

// -------------------- command handlers --------------------

/**
 * A concrete command writes state via `ctx.self.setState`. May be async.
 * Either `(ctx)` (no input) or `(input, ctx)` (with input).
 *
 * Commands without a paired loader run live in any environment. Commands paired with a loader
 * are replaced by JSON-fetch+merge in static-build mode.
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
 * A loader handler runs the side-effects required to populate state for a query.
 * Typically it calls one or more commands.
 *
 * The loader's *return* value is intentionally ignored — after the loader resolves, the runtime
 * invokes the same-named query with the same input and returns that. This enforces the 1:1
 * mapping between queries and loaders.
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
   * The path (relative to the service's static build directory) where this loader's JSON
   * patch file lives. Defaults to `<loaderName>/<hash(input)>.json` if not specified.
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

// -------------------- service definition --------------------

/**
 * Map types are intentionally permissive (`(...args: any[]) => any` rather than strict generics).
 * Tighter forms collide badly with TypeScript's contextual typing — they collapse via
 * `[any] extends [void]` distributive conditionals or fail to pick a single overload from a
 * union of function signatures, dropping `ctx` to implicit `any`.
 *
 * Trade-off: `ctx` in command/loader bodies must be annotated by the author for full
 * intellisense (`(input, ctx: ServiceCtx<MyState>) => …`). The runtime is unaffected — arity
 * is detected from `handler.length`, and abstract commands are detected via `__kind`.
 */
export type QueriesMap<TState> = Record<string, (state: TState, ...rest: any[]) => any>;
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
  /** Initial state. Treated as the snapshot used to build the `state.json` artifact when this service participates in persistence. */
  readonly state: TState;
  readonly queries: TQueries;
  readonly commands: TCommands;
  /**
   * Persistence configuration. Three forms:
   *
   * - **Omitted (or empty map)** — default. The static build emits a `state.json` containing
   *   this service's full state. Registration fetches and deep-merges it (if a transport is
   *   installed).
   * - **`false`** — opt out entirely. No artifacts emitted, no fetch attempted on registration.
   *   For services whose state is session-local or always recomputed live.
   * - **A loader map** — same as default, plus the static build also emits one JSON file per
   *   enumerated input of each loader, and the runtime fetches those files lazily on query
   *   subscriptions (in static mode) instead of running the loader body.
   */
  readonly load?: TLoaders | false;
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
 */
export type InputOfQuery<Q> = Q extends (...args: infer P) => any
  ? P extends readonly [any, infer I]
    ? I
    : void
  : void;
export type OutputOfQuery<Q> = Q extends (state: any, ...args: any[]) => infer R ? R : never;

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
 * Infrastructure layers (build pipeline, transport) work against the `ServiceRuntime` class
 * directly, which retains state/patches APIs that aren't part of this public surface.
 */
export interface ServiceStore<TDef extends ServiceDefinition<any, any, any, any>> {
  readonly id: string;
  readonly definition: TDef;
  readonly queries: SubscribableQueries<TDef['queries']>;
  readonly commands: CallableCommands<TDef['commands']>;
  /**
   * Resolves once any static-mode initial loading has finished (fetching and deep-merging
   * `state.json`). Resolves immediately if no static transport was supplied at registration.
   *
   * Queries can still be called before `ready` resolves — they'll just see the in-memory
   * default state and may emit a follow-up notification once the fetched state is merged in.
   */
  readonly ready: Promise<void>;
}

// -------------------- patches (infrastructure-facing) --------------------

/**
 * An Immer-style patch describing a single state mutation.
 *
 * Not part of the consumer-facing ServiceStore. Exposed via `ServiceRuntime`'s
 * infrastructure-facing API for the build pipeline (per-loader JSON file serialization)
 * and for the cross-runtime channel transport (sync messages).
 */
export interface StatePatch {
  op: 'replace' | 'remove' | 'add';
  path: (string | number)[];
  value?: unknown;
}
