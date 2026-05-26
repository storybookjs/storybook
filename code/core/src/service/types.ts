/**
 * Core type definitions for the Open Service Architecture.
 *
 * Four primitives:
 *  - **state**: a single in-memory object per service, *private* to the service.
 *  - **queries**: schema-validated, synchronous selectors over state. Read-only contract.
 *  - **commands**: schema-validated, possibly async writers that mutate state via `ctx.self.setState`.
 *  - **query preloads**: optional read-triggered population, statically pre-renderable.
 *
 * Schemas are required: every query and every command declares an `input` and `output` schema
 * (Standard Schema v1 — zod, valibot, arktype all satisfy). The runtime validates at the
 * boundary; types flow from the schemas via `StandardSchemaV1.InferInput / InferOutput`.
 *
 * Definition vs. registration:
 *  - A service *definition* declares state, queries, and commands. A command whose `handler`
 *    field is missing is **abstract** — its implementation must be supplied at registration.
 *  - At *registration* time, abstract handlers land and any concrete handlers can be overridden.
 *    That split lets one shared definition run in multiple environments (manager / preview /
 *    server) with environment-specific bodies.
 */

import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { z } from 'zod';

// -------------------- schema utility types --------------------

/** Standard Schema v1 constraint. Any zod / valibot / arktype schema satisfies it. */
export type AnySchema = StandardSchemaV1<unknown, unknown>;

/**
 * Raw caller-facing value type accepted by a schema.
 *
 * Zod types are resolved via `z.input<>` — `@standard-schema/spec`'s `InferInput` does not
 * connect to Zod's `~standard` metadata, so using it alone yields `unknown` for `z.string()` etc.
 */
export type InferSchemaInput<S extends AnySchema> = S extends z.ZodTypeAny
  ? z.input<S>
  : StandardSchemaV1.InferInput<S>;

/** Parsed value type produced by a schema after validation. */
export type InferSchemaOutput<S extends AnySchema> = S extends z.ZodTypeAny
  ? z.infer<S>
  : StandardSchemaV1.InferOutput<S>;

/**
 * True when a schema represents a no-input operation (`z.void()` → `void`, not `undefined`).
 *
 * We must not use `[undefined] extends [void]` — in TypeScript that is true, but `[void] extends
 * [undefined]` is false, which incorrectly classifies `z.void()` as input-keyed.
 */
type IsNoInputSchema<S extends AnySchema> = [InferSchemaInput<S>] extends [never]
  ? false
  : [InferSchemaInput<S>] extends [undefined]
    ? true
    : [InferSchemaInput<S>] extends [void]
      ? true
      : false;

/**
 * Bivariant function type — keeps handler/selector maps assignable without collapsing parameter
 * types to `unknown` when definitions are checked against `AnyQueryDef` / `AnyCommandDef`.
 * Borrowed from the open-service PR (#34860).
 */
type BivariantCallback<TArgs extends unknown[], TResult> = {
  bivarianceHack(...args: TArgs): TResult;
}['bivarianceHack'];

// -------------------- state mutation --------------------

/**
 * Mutate a draft of the state. Immer-backed: this is a real draft you can assign to, push to,
 * delete from, etc. The runtime captures the minimal patch list and applies it as a single
 * immutable transition.
 */
export type StateMutator<TState> = (draft: TState) => void;

// -------------------- build-time context --------------------

/**
 * Build-time context passed to a query's `inputs` and `path` callbacks. Will grow to include
 * `ctx.runtime[serviceId].queries.x()` so enumeration can read from other services.
 */
export interface BuildCtx {
  readonly isBuild: true;
}

// -------------------- runtime ctx handed to commands & query preloads --------------------

export interface ServiceCtx<TState> {
  readonly self: SelfHandle<TState>;
}

export interface SelfHandle<TState> {
  /** Read the current state. Available only inside command/preload bodies. */
  getState(): TState;
  /**
   * Mutate state via an Immer draft. Available only inside command/preload bodies.
   *
   * The signature is inlined (rather than `mutator: StateMutator<TState>`) to give TypeScript
   * the most direct contextual-typing path for the draft.
   */
  setState(mutator: (draft: TState) => void): void;
  /** Callable commands API on the service itself. Loose-typed inside the ctx. */
  readonly commands: Readonly<Record<string, (input?: any) => Promise<any>>>;
  /** Callable queries API on the service itself. */
  readonly queries: Readonly<Record<string, (input?: any) => any>>;
}

// -------------------- query definition --------------------

/**
 * A query is a schema-validated selector over state.
 *
 *  - `input` and `output` are Standard Schema v1 schemas.
 *  - `select` derives the output value from state and (optionally) a parsed input. Pure and sync.
 *  - `preload` (optional) is a read-triggered side effect that populates state; the static
 *    build runs it for every enumerated input.
 *  - `inputs` (optional) enumerates inputs the static build pre-renders.
 *  - `path` (optional) controls the per-input filename.
 *
 * No-input queries are encoded by `input: <void schema>` (e.g. `z.void()`); `InferSchemaOutput`
 * resolves to `void`, and the `select`/`preload`/`path` signatures collapse to their no-input
 * variants automatically.
 */
export interface QueryDef<
  TState = any,
  TInputSchema extends AnySchema = AnySchema,
  TOutputSchema extends AnySchema = AnySchema,
> {
  readonly input: TInputSchema;
  readonly output: TOutputSchema;
  readonly select: IsNoInputSchema<TInputSchema> extends true
    ? (state: TState) => InferSchemaOutput<TOutputSchema>
    : (state: TState, input: InferSchemaOutput<TInputSchema>) => InferSchemaOutput<TOutputSchema>;
  readonly preload?: IsNoInputSchema<TInputSchema> extends true
    ? (ctx: ServiceCtx<TState>) => void | Promise<void>
    : (input: InferSchemaOutput<TInputSchema>, ctx: ServiceCtx<TState>) => void | Promise<void>;
  readonly inputs?:
    | readonly InferSchemaInput<TInputSchema>[]
    | ((
        ctx: BuildCtx
      ) =>
        | readonly InferSchemaInput<TInputSchema>[]
        | Promise<readonly InferSchemaInput<TInputSchema>[]>);
  readonly path?: IsNoInputSchema<TInputSchema> extends true
    ? (ctx: BuildCtx) => string
    : (ctx: BuildCtx, input: InferSchemaOutput<TInputSchema>) => string;
}

// -------------------- command definition --------------------

/**
 * A command is a schema-validated writer.
 *
 *  - `input` and `output` are Standard Schema v1 schemas.
 *  - `handler` (optional) is the body. If omitted the command is **abstract** and registration
 *    must supply a handler; the runtime throws at construction time if it's still missing.
 *  - Handlers may be sync or async; the runtime always returns `Promise<output>` to callers.
 */
export interface CommandDef<
  TState = any,
  TInputSchema extends AnySchema = AnySchema,
  TOutputSchema extends AnySchema = AnySchema,
> {
  readonly input: TInputSchema;
  readonly output: TOutputSchema;
  readonly handler?: IsNoInputSchema<TInputSchema> extends true
    ? (
        ctx: ServiceCtx<TState>
      ) => InferSchemaInput<TOutputSchema> | Promise<InferSchemaInput<TOutputSchema>>
    : (
        input: InferSchemaOutput<TInputSchema>,
        ctx: ServiceCtx<TState>
      ) => InferSchemaInput<TOutputSchema> | Promise<InferSchemaInput<TOutputSchema>>;
}

// -------------------- map constraints --------------------

/**
 * Any query definition bound to `TState`. Used as the record value constraint in `QueriesMap`.
 * Handlers are bivariant so concrete parameter types survive assignability checks.
 */
export type AnyQueryDef<TState = any> = {
  readonly input: AnySchema;
  readonly output: AnySchema;
  readonly select: BivariantCallback<[state: TState, input?: unknown], unknown>;
  readonly preload?: BivariantCallback<
    [input: unknown, ctx: ServiceCtx<TState>],
    void | Promise<void>
  >;
  readonly inputs?:
    | readonly unknown[]
    | ((ctx: BuildCtx) => readonly unknown[] | Promise<readonly unknown[]>);
  readonly path?: BivariantCallback<[ctx: BuildCtx, input?: unknown], string>;
};

/** Any command definition bound to `TState`. */
export type AnyCommandDef<TState = any> = {
  readonly input: AnySchema;
  readonly output: AnySchema;
  readonly handler?: BivariantCallback<
    [input: unknown, ctx: ServiceCtx<TState>],
    unknown | Promise<unknown>
  >;
};

export type QueriesMap<TState> = Record<string, AnyQueryDef<TState>>;
export type CommandsMap<TState> = Record<string, AnyCommandDef<TState>>;

// -------------------- service definition --------------------

export interface ServiceDefinition<
  TState = unknown,
  TQueries extends QueriesMap<TState> = QueriesMap<TState>,
  TCommands extends CommandsMap<TState> = CommandsMap<TState>,
> {
  /** Globally unique service id. Convention: `core/<name>` for built-ins, `<addonId>/<name>` for addons. */
  readonly id: string;
  /** Initial state. */
  readonly state: TState;
  readonly queries: TQueries;
  readonly commands: TCommands;
}

// -------------------- registration --------------------

/**
 * Registration-time options. Provides handlers for abstract commands declared in the definition,
 * and lets you override concrete command handlers if the same definition is used in multiple
 * environments with environment-specific bodies.
 */
export interface ServiceRegistration<TDef extends ServiceDefinition<any, any, any>> {
  commands?: CommandOverrides<TDef>;
}

// `ServiceStaticTransport` lives in `static-transport.ts`. Re-export here for convenience.
export type { ServiceStaticTransport } from './static-transport.ts';

/**
 * Per-command override map. For each command, the override matches the `handler` shape the
 * command's input/output schemas imply. Optional throughout — abstract commands MUST be
 * supplied here; concrete commands MAY be overridden.
 */
export type CommandOverrides<TDef extends ServiceDefinition<any, any, any>> = {
  [K in keyof TDef['commands']]?: TDef['commands'][K] extends CommandDef<
    TDef['state'],
    infer TIn,
    infer TOut
  >
    ? IsNoInputSchema<TIn> extends true
      ? (ctx: ServiceCtx<TDef['state']>) => InferSchemaInput<TOut> | Promise<InferSchemaInput<TOut>>
      : (
          input: InferSchemaOutput<TIn>,
          ctx: ServiceCtx<TDef['state']>
        ) => InferSchemaInput<TOut> | Promise<InferSchemaInput<TOut>>
    : never;
};

// -------------------- input/output inference for consumers --------------------

/**
 * What a consumer passes in when calling a query. The raw caller-facing input, inferred from
 * the query's `input` schema via `StandardSchemaV1.InferInput`. The runtime validates this and
 * hands the parsed value to `select`.
 */
export type InputOfQuery<Q> =
  Q extends QueryDef<any, infer TIn, any> ? InferSchemaInput<TIn> : never;

/** What a consumer gets back from a query. The parsed output, post-validation. */
export type OutputOfQuery<Q> =
  Q extends QueryDef<any, any, infer TOut> ? InferSchemaOutput<TOut> : never;

/** What a consumer passes in when calling a command. */
export type InputOfCommand<C> =
  C extends CommandDef<any, infer TIn, any> ? InferSchemaInput<TIn> : never;

/** What a consumer gets back from a command (after output-schema validation). */
export type OutputOfCommand<C> =
  C extends CommandDef<any, any, infer TOut> ? InferSchemaOutput<TOut> : never;

// -------------------- consumer-facing service handle --------------------

/** A subscribable query handle: callable for one-shot reads, plus a `.subscribe()` method. */
export type SubscribableQuery<TInput, TOutput> = [TInput] extends [void | undefined]
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
  [K in keyof TC]: [InputOfCommand<TC[K]>] extends [void | undefined]
    ? () => Promise<OutputOfCommand<TC[K]>>
    : (input: InputOfCommand<TC[K]>) => Promise<OutputOfCommand<TC[K]>>;
};

/**
 * Public-facing handle returned by `registerService` / `getService`.
 *
 * State is *not* on this interface — it's internal to the service. To read data, call a query.
 * To change data, call a command. To react to changes, subscribe to a query.
 */
export interface ServiceStore<TDef extends ServiceDefinition<any, any, any>> {
  readonly id: string;
  readonly definition: TDef;
  readonly queries: SubscribableQueries<TDef['queries']>;
  readonly commands: CallableCommands<TDef['commands']>;
}
