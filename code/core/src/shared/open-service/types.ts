import type { StandardSchemaV1 } from '@standard-schema/spec';

/** File map used by static snapshot building. Each key represents one serialized state snapshot. */
export type StaticStore = Record<string, unknown>;

/** Generic Standard Schema constraint used across open-service definitions. */
export type AnySchema = StandardSchemaV1<unknown, unknown>;

/** Stable alias for service identifiers across definition, runtime, and registration APIs. */
export type ServiceId = string;

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
 * callbacks like `handler`, `load`, and `static.path`.
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
 * Public runtime shape of a query.
 *
 * The primary call returns the handler result synchronously. Calling it also triggers `load` in
 * the background, deduped while another load for the same input is already in flight. Use
 * `.loaded(input)` when the caller wants to await the full load (including transitive dependencies)
 * before reading. Use `.subscribe(input, callback)` to receive updates whenever tracked state
 * changes; subscribers receive their first value asynchronously.
 */
export type Query<TInput, TOutput> = {
  (input: TInput): TOutput;
  loaded(input: TInput): Promise<TOutput>;
  subscribe(input: TInput, callback: (value: TOutput) => void): () => void;
};

/**
 * Read-only service handle exposed to query handlers.
 *
 * Query handlers are strict readers: they can read state and call sibling queries, but they cannot
 * mutate state and cannot invoke commands. Mutations belong in commands; load-side preparation
 * belongs in `load`.
 */
export type QuerySelf<TState = unknown> = {
  readonly state: TState;
  queries: Record<string, Query<unknown, unknown>>;
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
> = QuerySelf<TState> & {
  commands: CommandFunctions<TCommandInputSchemas, TCommandOutputSchemas>;
};

/**
 * Mutable service handle exposed to command handlers.
 *
 * Commands receive both `setState` for direct draft mutation and `commands` so one command can
 * delegate to another within the same service.
 */
export type CommandSelf<
  TState = unknown,
  TCommandInputSchemas extends OperationInputSchemas = OperationInputSchemas,
  TCommandOutputSchemas extends MatchingOutputSchemas<TCommandInputSchemas> =
    MatchingOutputSchemas<TCommandInputSchemas>,
> = LoadSelf<TState, TCommandInputSchemas, TCommandOutputSchemas> & {
  setState(mutate: (draft: TState) => void): void;
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
};

export type ServiceDescriptor = {
  id: ServiceId;
  description?: string;
  queries: Record<string, OperationDescriptor>;
  commands: Record<string, OperationDescriptor>;
};

export interface ServiceRegistryApi {
  listServices(): Promise<ServiceSummary[]>;
  describeService(serviceId: ServiceId): Promise<ServiceDescriptor>;
  getService(serviceId: ServiceId): RuntimeService;
}

export type RuntimeService = ServiceInstance<unknown, Queries<unknown>, Commands<unknown>> &
  ServiceRegistryApi;

/** Context passed to query handlers. */
export type QueryCtx<TState> = {
  self: QuerySelf<TState>;
  getService: ServiceRegistryApi['getService'];
};

/** Context passed to `load` functions and static-input enumerators. */
export type LoadCtx<
  TState,
  TCommandInputSchemas extends OperationInputSchemas = OperationInputSchemas,
  TCommandOutputSchemas extends MatchingOutputSchemas<TCommandInputSchemas> =
    MatchingOutputSchemas<TCommandInputSchemas>,
> = {
  self: LoadSelf<TState, TCommandInputSchemas, TCommandOutputSchemas>;
  getService: ServiceRegistryApi['getService'];
};

/** Context passed to command handlers. */
export type CommandCtx<
  TState,
  TCommandInputSchemas extends OperationInputSchemas = OperationInputSchemas,
  TCommandOutputSchemas extends MatchingOutputSchemas<TCommandInputSchemas> =
    MatchingOutputSchemas<TCommandInputSchemas>,
> = {
  self: CommandSelf<TState, TCommandInputSchemas, TCommandOutputSchemas>;
  getService: ServiceRegistryApi['getService'];
};

/**
 * Optional static metadata for a query.
 *
 * `inputs()` enumerates the raw caller-facing inputs that should be prebuilt, while `path()` can
 * customize which serialized state file receives the resulting state snapshot.
 */
export type QueryStaticDefinition<
  TState,
  TInput = unknown,
  TParsedInput = TInput,
  TCommandInputSchemas extends OperationInputSchemas = OperationInputSchemas,
  TCommandOutputSchemas extends MatchingOutputSchemas<TCommandInputSchemas> =
    MatchingOutputSchemas<TCommandInputSchemas>,
> = {
  path?: BivariantCallback<
    [input: TParsedInput, ctx: LoadCtx<TState, TCommandInputSchemas, TCommandOutputSchemas>],
    string
  >;
  inputs: BivariantCallback<
    [ctx: LoadCtx<TState, TCommandInputSchemas, TCommandOutputSchemas>],
    TInput[] | Promise<TInput[]>
  >;
};

/**
 * Declarative definition for one query.
 *
 * Queries validate caller input synchronously, run a synchronous read-only handler, and validate
 * the resolved output. The optional `load` hook is fired in the background on each query call
 * (deduped while in flight) so subscribers and `.loaded()` callers see fully populated state.
 */
export type QueryDefinition<
  TState,
  TInputSchema extends AnySchema,
  TOutputSchema extends AnySchema,
  TCommandInputSchemas extends OperationInputSchemas = OperationInputSchemas,
  TCommandOutputSchemas extends MatchingOutputSchemas<TCommandInputSchemas> =
    MatchingOutputSchemas<TCommandInputSchemas>,
> = {
  description?: string;
  input: TInputSchema;
  output: TOutputSchema;
  handler?: BivariantCallback<
    [input: InferSchemaOutput<TInputSchema>, ctx: QueryCtx<TState>],
    InferSchemaInput<TOutputSchema>
  >;
  load?: BivariantCallback<
    [
      input: InferSchemaOutput<TInputSchema>,
      ctx: LoadCtx<TState, TCommandInputSchemas, TCommandOutputSchemas>,
    ],
    void | Promise<void>
  >;
  static?: QueryStaticDefinition<
    TState,
    InferSchemaInput<TInputSchema>,
    InferSchemaOutput<TInputSchema>,
    TCommandInputSchemas,
    TCommandOutputSchemas
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
> = {
  description?: string;
  input: TInputSchema;
  output: TOutputSchema;
  handler?: BivariantCallback<
    [input: InferSchemaOutput<TInputSchema>, ctx: CommandCtx<TState>],
    InferSchemaInput<TOutputSchema> | Promise<InferSchemaInput<TOutputSchema>>
  >;
};

/** Internal structural constraint used to store any query definition in a record. */
export type AnyQueryDefinition<TState> = {
  description?: string;
  input: AnySchema;
  output: AnySchema;
  handler?: BivariantCallback<[input: unknown, ctx: QueryCtx<TState>], unknown>;
  load?: BivariantCallback<[input: unknown, ctx: LoadCtx<TState>], void | Promise<void>>;
  static?: QueryStaticDefinition<TState, unknown, unknown>;
};

/** Internal structural constraint used to store any command definition in a record. */
export type AnyCommandDefinition<TState> = {
  description?: string;
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
  initialState: TState;
  queries: TQueries;
  commands: TCommands;
};

/** Runtime service instance derived from a `ServiceDefinition`. */
export type ServiceInstance<
  TState,
  TQueries extends Queries<TState>,
  TCommands extends Commands<TState>,
> = {
  queries: {
    [TKey in keyof TQueries]: TQueries[TKey] extends QueryDefinition<
      TState,
      infer TInputSchema,
      infer TOutputSchema
    >
      ? Query<InferSchemaInput<TInputSchema>, InferSchemaOutput<TOutputSchema>>
      : never;
  };
  commands: {
    [TKey in keyof TCommands]: TCommands[TKey] extends CommandDefinition<
      TState,
      infer TInputSchema,
      infer TOutputSchema
    >
      ? (input: InferSchemaInput<TInputSchema>) => Promise<InferSchemaOutput<TOutputSchema>>
      : never;
  };
};

export type ServiceQueryRegistration<TState, TQuery extends AnyQueryDefinition<TState>> = Pick<
  TQuery,
  'handler' | 'load' | 'static'
>;

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
    [TKey in keyof TQueries]?: ServiceQueryRegistration<TState, TQueries[TKey]>;
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
