import type { StandardSchemaV1 } from '@standard-schema/spec';

/** File map used by static snapshot building. Each key represents one serialized state snapshot. */
export type StaticStore = Record<string, unknown>;

/** Generic Standard Schema constraint used across open-service definitions. */
export type AnySchema = StandardSchemaV1<unknown, unknown>;

/** Stable alias for service identifiers across definition, runtime, and registration APIs. */
export type ServiceId = string;

/**
 * Constrains a service's state to a plain object — the only shape the architecture supports.
 *
 * This is not an arbitrary restriction; two layers require it:
 *
 * 1. State is wrapped in a `deepSignal` proxy for fine-grained per-field reactivity, and `deepSignal`
 *    throws ("this object can't be observed") on primitives, `null`, and `undefined` — there are no
 *    fields to track on a scalar.
 * 2. Cross-peer sync (`applyStatePatch` in `service-sync.ts`) merges state by walking object keys;
 *    it has no notion of replacing a whole scalar, so the wire protocol only carries keyed objects.
 *
 * Arrays are technically observable by `deepSignal` but are still rejected here: `applyStatePatch`
 * replaces arrays wholesale rather than merging by key, so a *top-level* array state would silently
 * fail to sync between peers. Wrap collections in a field instead (`{ items: [...] }`).
 *
 * Authoring helpers pair this with an `extends object` bound (which rejects primitives, `null`, and
 * `undefined` while still accepting both `interface` and `type` declarations). The naked `TState` in
 * the intersection keeps it transparent to inference; only an array collapses to the branded error.
 */
export type ServiceState<TState> = TState &
  (TState extends readonly unknown[]
    ? {
        __openServiceStateError: 'Service state must be a plain object, not an array.';
      }
    : unknown);

/** Public schema shape exposed when describing a schema-backed service contract. */
export type SchemaDescriptor = AnySchema;

/** Convenience alias for declaring Standard Schema compatible input/output contracts. */
export type Schema<TInput = unknown, TOutput = TInput> = StandardSchemaV1<TInput, TOutput>;

/** Raw caller-facing value type accepted by a schema-backed operation. */
export type InferSchemaInput<TSchema extends AnySchema> = StandardSchemaV1.InferInput<TSchema>;

/** Parsed value type produced by a schema after validation. */
export type InferSchemaOutput<TSchema extends AnySchema> = StandardSchemaV1.InferOutput<TSchema>;

/**
 * Named schema maps are the core inference surface for inline open-service authoring.
 *
 * `defineService()` infers one input-schema map and one output-schema map per operation family
 * (queries and commands). Keeping those maps separate gives TypeScript a place to correlate the
 * `input` and `output` properties of each inline object before it contextually types sibling
 * callbacks like `handler`, `load`, `staticPath`, and `staticInputs`.
 */
export type OperationInputSchemas = Record<string, AnySchema>;

/**
 * Output-schema maps must stay key-aligned with their input-schema map.
 *
 * The authoring helper uses this alias instead of a plain `Record<string, AnySchema>` so each
 * operation key retains its own input/output schema pair during inference.
 */
export type MatchingOutputSchemas<TInputSchemas extends OperationInputSchemas> = {
  [TKey in keyof TInputSchemas]: AnySchema;
};

/**
 * Internal utility used to keep handler maps assignable without collapsing everything to `unknown`.
 */
type BivariantCallback<TArgs extends unknown[], TResult> = {
  bivarianceHack(...args: TArgs): TResult;
}['bivarianceHack'];

/** Runtime shape shared by all command collections after they are built. */
export type Command = Record<string, (input: unknown) => Promise<unknown>>;

/**
 * Runtime command map derived directly from the inferred command schema maps.
 *
 * Queries only need command-call typing, not the full command definition objects, so this helper
 * keeps query contexts readable while still preserving exact input/output types per command.
 */
export type CommandFunctions<
  TCommandInputSchemas extends OperationInputSchemas,
  TCommandOutputSchemas extends MatchingOutputSchemas<TCommandInputSchemas>,
> = {
  [TKey in keyof TCommandInputSchemas]: BivariantCallback<
    [input: InferSchemaInput<TCommandInputSchemas[TKey]>],
    Promise<InferSchemaOutput<TCommandOutputSchemas[TKey]>>
  >;
};

/**
 * Coarse lifecycle of a query's `load`, modeled after TanStack Query's `status`.
 *
 * - `pending` — no successful load has completed yet (and none has failed). The query may still
 *   expose `data` (the synchronous "current best" handler result), but nothing has been loaded.
 * - `error` — the most recent attempt (load rejection, or a synchronous handler / validation throw)
 *   failed. `data` keeps the last successful value, if any.
 * - `success` — a load has completed (or the query has no `load`, so there is nothing to load).
 */
export type QueryStatus = 'pending' | 'error' | 'success';

/**
 * Whether a `load` is currently running, modeled after TanStack Query's `fetchStatus` — but named
 * with our own `load` vocabulary because open-service "loads" are any slow async work (computation,
 * extraction, I/O), not specifically remote fetching.
 *
 * - `loading` — a `load` is in flight (the first load, or a reactive background re-load).
 * - `idle` — no `load` is currently running.
 */
export type LoadStatus = 'loading' | 'idle';

/**
 * The reactive state of a subscribed query: its current `data` plus the lifecycle of its `load`.
 *
 * `data` and `status` are independent. `data` is the synchronous handler result ("current best
 * effort") and holds the last successful value (or `undefined` before the first success / when a
 * handler throws), while `status`/`loadStatus`/`error` describe the asynchronous `load` lifecycle
 * tracked per subscription. A query with no `load` is `success`/`idle` from its first emission.
 *
 * `isLoading` is intentionally "any load in flight" (TanStack's `isFetching`), and
 * `isInitialLoading` is "a load is in flight and there is nothing to show yet"; the names follow our
 * `load` vocabulary rather than TanStack's `fetch`/`load` split. Unlike TanStack Query, a
 * subscription here can attach to a query whose `data` is already cached in service state, so
 * `isInitialLoading` additionally requires `data === undefined` — it never flags over cached data.
 */
export type QueryState<TData> = {
  /** Last successfully produced value; `undefined` before the first success. */
  data: TData | undefined;
  /** The failure that produced `status: 'error'`, otherwise `undefined`. */
  error: Error | undefined;
  status: QueryStatus;
  loadStatus: LoadStatus;
  /** `status === 'pending'`. */
  isPending: boolean;
  /** `status === 'success'`. */
  isSuccess: boolean;
  /** `status === 'error'`. */
  isError: boolean;
  /** `loadStatus === 'loading'` — any load in flight, foreground or background. */
  isLoading: boolean;
  /** `isPending && isLoading && data === undefined` — a first load with nothing to show yet. */
  isInitialLoading: boolean;
  /** `isLoading && !isPending` — a background re-load while data is already shown. */
  isRefreshing: boolean;
};

/**
 * Public runtime shape of a query.
 *
 * - `.get(input)` reads synchronously: it validates input, runs the handler against current state,
 *   and returns the validated result. It does **not** fire the query's `load` — it is a pure
 *   "current best effort" read. (Reads of *other* queries from inside a handler or `load` body still
 *   participate in dependency tracking, so `.loaded()` and subscriptions trigger those dependency
 *   loads; a bare consumer `.get()` does not.)
 * - `.loaded(input)` awaits the full load — this query's `load` plus every transitively read
 *   dependency — before resolving with the validated result.
 * - `.subscribe(input, callback)` invokes `callback` synchronously with the current {@link QueryState}
 *   and again whenever tracked state or the load lifecycle changes (deduped on the whole state).
 *   Subscribing is what fires the query's reactive `load`.
 *
 * There is intentionally no bare-call form: a previous `query(input)` that returned synchronously
 * *and* fired the `load` behind the scenes was removed because the implicit background load was
 * confusing. Read with `.get(input)`, await with `.loaded(input)`, observe with `.subscribe(...)`.
 *
 * Queries whose input schema resolves to `undefined` (for example `v.void()`) may be called with
 * zero arguments: `query.get()`, `query.loaded()`.
 */
type InputQuery<TInput, TOutput> = {
  get(input: TInput): TOutput;
  loaded(input: TInput): Promise<TOutput>;
  subscribe(input: TInput, callback: (state: QueryState<TOutput>) => void): () => void;
  subscribe<TSelected>(
    input: TInput,
    selector: (value: TOutput) => TSelected,
    callback: (state: QueryState<TSelected>) => void
  ): () => void;
};

/** Zero-argument overloads merged into {@link Query} when the input schema is void. */
type VoidQuery<TOutput> = {
  get(): TOutput;
  loaded(): Promise<TOutput>;
  subscribe(callback: (state: QueryState<TOutput>) => void): () => void;
  subscribe<TSelected>(
    selector: (value: TOutput) => TSelected,
    callback: (state: QueryState<TSelected>) => void
  ): () => void;
};

export type Query<TInput, TOutput> = undefined extends TInput
  ? VoidQuery<TOutput> & InputQuery<TInput, TOutput>
  : InputQuery<TInput, TOutput>;

/**
 * Runtime query map derived directly from the inferred query schema maps.
 *
 * The query counterpart to {@link CommandFunctions}: it preserves each sibling query's exact
 * input/output types on the read-only `self.queries` handle, so a handler or `load` can call
 * `self.queries.someQuery.get(input)` without manual casts. `defineService` computes this map from
 * the inferred query schema maps and threads it into the handler/load contexts as their `TQueries`;
 * the erased {@link AnyQueryFunctions} bound is used everywhere the concrete map is not known.
 */
export type QueryFunctions<
  TQueryInputSchemas extends OperationInputSchemas,
  TQueryOutputSchemas extends MatchingOutputSchemas<TQueryInputSchemas>,
> = {
  [TKey in keyof TQueryInputSchemas]: Query<
    InferSchemaInput<TQueryInputSchemas[TKey]>,
    InferSchemaOutput<TQueryOutputSchemas[TKey]>
  >;
};

/**
 * Permissive bound for a `self.queries` handle.
 *
 * Every {@link Query} — input or void — structurally satisfies {@link InputQuery} (the void
 * overloads are additive), so this is the supertype that any concrete {@link QueryFunctions} map is
 * assignable to. It is the bound (and erased default) for the `TQueries` parameter below, which lets
 * the precise per-service map flow into handler contexts while still erasing cleanly into the
 * structural `AnyQueryDefinition` storage constraint. Using `Query<unknown, unknown>` here instead
 * would wrongly demand the void zero-arg overloads from input queries.
 */
export type AnyQueryFunctions = Record<string, InputQuery<unknown, unknown>>;

/**
 * Read-only service handle exposed to query handlers.
 *
 * Query handlers are strict readers: they can read state and call sibling queries, but they cannot
 * mutate state and cannot invoke commands. Mutations belong in commands; load-side preparation
 * belongs in `load`.
 */
export type QuerySelf<TState = unknown, TQueries extends AnyQueryFunctions = AnyQueryFunctions> = {
  readonly state: TState;
  queries: TQueries;
};

/**
 * Load handle exposed to `load` functions.
 *
 * `load` may read state and queries, and may invoke declared commands to mutate state. It does
 * not receive `setState` directly — all writes must flow through commands so authors keep one
 * documented mutation surface per service.
 */
export type LoadSelf<
  TState = unknown,
  TCommandInputSchemas extends OperationInputSchemas = OperationInputSchemas,
  TCommandOutputSchemas extends MatchingOutputSchemas<TCommandInputSchemas> =
    MatchingOutputSchemas<TCommandInputSchemas>,
  TQueries extends AnyQueryFunctions = AnyQueryFunctions,
> = QuerySelf<TState, TQueries> & {
  commands: CommandFunctions<TCommandInputSchemas, TCommandOutputSchemas>;
};

/**
 * Mutable service handle exposed to command handlers.
 *
 * Commands receive both `setState` for direct state mutation and `commands` so one command can
 * delegate to another within the same service.
 */
export type CommandSelf<
  TState = unknown,
  TCommandInputSchemas extends OperationInputSchemas = OperationInputSchemas,
  TCommandOutputSchemas extends MatchingOutputSchemas<TCommandInputSchemas> =
    MatchingOutputSchemas<TCommandInputSchemas>,
  TQueries extends AnyQueryFunctions = AnyQueryFunctions,
> = LoadSelf<TState, TCommandInputSchemas, TCommandOutputSchemas, TQueries> & {
  setState(mutate: (state: TState) => void): void;
};

export type ServiceSummary = {
  id: ServiceId;
  description?: string;
  queryNames: string[];
  commandNames: string[];
};

export type OperationDescriptor = {
  name: string;
  description?: string;
  input: SchemaDescriptor;
  output: SchemaDescriptor;
  /** Present when the query declares `staticPath` at definition time. */
  staticPath?: true;
};

export type ServiceDescriptor = {
  id: ServiceId;
  description?: string;
  queries: Record<string, OperationDescriptor>;
  commands: Record<string, OperationDescriptor>;
};

/** Context passed to query handlers. */
export type QueryCtx<TState, TQueries extends AnyQueryFunctions = AnyQueryFunctions> = {
  self: QuerySelf<TState, TQueries>;
  getService: ServiceRegistryApi['getService'];
};

/** Context passed to `load` functions and static-input enumerators. */
export type LoadCtx<
  TState,
  TCommandInputSchemas extends OperationInputSchemas = OperationInputSchemas,
  TCommandOutputSchemas extends MatchingOutputSchemas<TCommandInputSchemas> =
    MatchingOutputSchemas<TCommandInputSchemas>,
  TQueries extends AnyQueryFunctions = AnyQueryFunctions,
> = {
  self: LoadSelf<TState, TCommandInputSchemas, TCommandOutputSchemas, TQueries>;
  getService: ServiceRegistryApi['getService'];
};

/** Static input enumerator stored on registered definitions; always receives load context. */
export type RegisteredStaticInputs<TState> = BivariantCallback<
  [ctx: LoadCtx<TState>],
  unknown[] | Promise<unknown[]>
>;

/** Context passed to command handlers. */
export type CommandCtx<
  TState,
  TCommandInputSchemas extends OperationInputSchemas = OperationInputSchemas,
  TCommandOutputSchemas extends MatchingOutputSchemas<TCommandInputSchemas> =
    MatchingOutputSchemas<TCommandInputSchemas>,
  TQueries extends AnyQueryFunctions = AnyQueryFunctions,
> = {
  self: CommandSelf<TState, TCommandInputSchemas, TCommandOutputSchemas, TQueries>;
  getService: ServiceRegistryApi['getService'];
};

/**
 * Declarative definition for one query.
 *
 * Queries validate caller input synchronously, run a synchronous read-only handler, and validate
 * the resolved output. The optional `load` hook is fired by subscriptions (reactively) and by
 * `.loaded()` callers (drained to completion), deduped per `(service, query, input)` while one is
 * already in flight — a bare `.get()` read never fires it.
 *
 * Queries that participate in static JSON generation declare `staticPath` at definition time.
 * `staticInputs` may also be declared here when the input list has no runtime dependencies; inputs
 * that need registry or story-index context belong in server registration instead.
 */
export type QueryDefinition<
  TState,
  TInputSchema extends AnySchema,
  TOutputSchema extends AnySchema,
  TCommandInputSchemas extends OperationInputSchemas = OperationInputSchemas,
  TCommandOutputSchemas extends MatchingOutputSchemas<TCommandInputSchemas> =
    MatchingOutputSchemas<TCommandInputSchemas>,
  TQueries extends AnyQueryFunctions = AnyQueryFunctions,
> = {
  description?: string;
  /**
   * When true, hides this query from `describeService()` output. Defaults to false. Does not disable
   * the query at runtime — callers with a service handle can still invoke it.
   */
  internal?: boolean;
  input: TInputSchema;
  output: TOutputSchema;
  /** Logical path for the serialized state snapshot, relative to this service's output folder. */
  staticPath?: BivariantCallback<[input: InferSchemaOutput<TInputSchema>], string>;
  /** Dependency-free static build inputs declared alongside the public contract. */
  staticInputs?: BivariantCallback<
    [],
    InferSchemaInput<TInputSchema>[] | Promise<InferSchemaInput<TInputSchema>[]>
  >;
  handler?: BivariantCallback<
    [input: InferSchemaOutput<TInputSchema>, ctx: QueryCtx<TState, TQueries>],
    InferSchemaInput<TOutputSchema>
  >;
  load?: BivariantCallback<
    [
      input: InferSchemaOutput<TInputSchema>,
      ctx: LoadCtx<TState, TCommandInputSchemas, TCommandOutputSchemas, TQueries>,
    ],
    void | Promise<void>
  >;
};

/**
 * Declarative definition for one command.
 *
 * Commands validate caller input, run against a mutable context, and validate the resolved output.
 */
export type CommandDefinition<
  TState,
  TInputSchema extends AnySchema,
  TOutputSchema extends AnySchema,
  TCommandInputSchemas extends OperationInputSchemas = OperationInputSchemas,
  TCommandOutputSchemas extends MatchingOutputSchemas<TCommandInputSchemas> =
    MatchingOutputSchemas<TCommandInputSchemas>,
  TQueries extends AnyQueryFunctions = AnyQueryFunctions,
> = {
  description?: string;
  /**
   * When true, hides this command from `describeService()` output. Defaults to false. Does not
   * disable the command at runtime — callers with a service handle can still invoke it.
   */
  internal?: boolean;
  input: TInputSchema;
  output: TOutputSchema;
  handler?: BivariantCallback<
    [
      input: InferSchemaOutput<TInputSchema>,
      ctx: CommandCtx<TState, TCommandInputSchemas, TCommandOutputSchemas, TQueries>,
    ],
    InferSchemaInput<TOutputSchema> | Promise<InferSchemaInput<TOutputSchema>>
  >;
};

/** Internal structural constraint used to store any query definition in a record. */
export type AnyQueryDefinition<TState> = {
  description?: string;
  internal?: boolean;
  input: AnySchema;
  output: AnySchema;
  staticPath?: BivariantCallback<[input: unknown], string>;
  staticInputs?: RegisteredStaticInputs<TState>;
  handler?: BivariantCallback<[input: unknown, ctx: QueryCtx<TState>], unknown>;
  load?: BivariantCallback<[input: unknown, ctx: LoadCtx<TState>], void | Promise<void>>;
};

/** Internal structural constraint used to store any command definition in a record. */
export type AnyCommandDefinition<TState> = {
  description?: string;
  internal?: boolean;
  input: AnySchema;
  output: AnySchema;
  handler?: BivariantCallback<
    [input: unknown, ctx: CommandCtx<TState>],
    unknown | Promise<unknown>
  >;
};

/** Named query map attached to a service definition. */
export type Queries<TState> = Record<string, AnyQueryDefinition<TState>>;
/** Named command map attached to a service definition. */
export type Commands<TState> = Record<string, AnyCommandDefinition<TState>>;

/** Top-level description of a service: identity, initial state, queries, and commands. */
export type ServiceDefinition<
  TState,
  TQueries extends Queries<TState>,
  TCommands extends Commands<TState>,
> = {
  id: ServiceId;
  description?: string;
  /**
   * When true, hides this service from `listServices()` output. Defaults to false. Does not disable
   * the service at runtime — callers can still resolve it through `getService()`.
   */
  internal?: boolean;
  /**
   * Initial state for the service. Must be a plain object (not a primitive, `null`, or array) — see
   * {@link ServiceState} for why. The authoring boundary (`defineService`) enforces this; the runtime
   * type stays `TState` so already-constructed definitions flow through the registry unchanged.
   */
  initialState: TState;
  queries: TQueries;
  commands: TCommands;
};

/** Structural constraint for any service definition stored in the registry. */
export type AnyServiceDefinition = ServiceDefinition<unknown, Queries<unknown>, Commands<unknown>>;

/** Runtime service instance derived from a `ServiceDefinition`. */
export type ServiceInstance<
  TState,
  TQueries extends Queries<TState>,
  TCommands extends Commands<TState>,
> = {
  queries: {
    [TKey in keyof TQueries]: TQueries[TKey] extends {
      input: infer TInputSchema extends AnySchema;
      output: infer TOutputSchema extends AnySchema;
    }
      ? Query<InferSchemaInput<TInputSchema>, InferSchemaOutput<TOutputSchema>>
      : never;
  };
  commands: {
    [TKey in keyof TCommands]: TCommands[TKey] extends {
      input: infer TInputSchema extends AnySchema;
      output: infer TOutputSchema extends AnySchema;
    }
      ? (input: InferSchemaInput<TInputSchema>) => Promise<InferSchemaOutput<TOutputSchema>>
      : never;
  };
};

/** Runtime instance type recovered from one authored service definition. */
export type ServiceInstanceOf<TDefinition extends AnyServiceDefinition> =
  TDefinition extends ServiceDefinition<infer TState, infer TQueries, infer TCommands>
    ? ServiceInstance<TState, TQueries, TCommands>
    : never;

export interface ServiceRegistryApi {
  listServices(): Promise<ServiceSummary[]>;
  describeService(serviceId: ServiceId): Promise<ServiceDescriptor>;
  getService<TInstance = RuntimeService>(serviceId: ServiceId): TInstance;
}

export type RuntimeService = ServiceInstance<unknown, Queries<unknown>, Commands<unknown>> &
  ServiceRegistryApi;

export type ServiceQueryRegistration<TState> = {
  /** Static build inputs that may depend on registry or other server context. */
  staticInputs?: RegisteredStaticInputs<TState>;
};

export type ServiceCommandRegistration<
  TState,
  TCommand extends AnyCommandDefinition<TState>,
> = Pick<TCommand, 'handler'>;

export type ServiceRegistrationOptions<
  TState,
  TQueries extends Queries<TState>,
  TCommands extends Commands<TState>,
> = {
  queries?: {
    [TKey in keyof TQueries]?: ServiceQueryRegistration<TState>;
  };
  commands?: {
    [TKey in keyof TCommands]?: ServiceCommandRegistration<TState, TCommands[TKey]>;
  };
};

export type ServerServiceRegistration<
  TState,
  TQueries extends Queries<TState>,
  TCommands extends Commands<TState>,
> = {
  definition: ServiceDefinition<TState, TQueries, TCommands>;
} & ServiceRegistrationOptions<TState, TQueries, TCommands>;

/** One completed static build task before it is merged into the final store map. */
export type BuildTaskResult = {
  path: string;
  state: unknown;
};
