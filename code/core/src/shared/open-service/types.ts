import type { StandardSchemaV1 } from '@standard-schema/spec';

/** File map used by static preloading. Each key represents one serialized state snapshot. */
export type StaticStore = Record<string, unknown>;

/** Generic Standard Schema constraint used across open-service definitions. */
export type AnySchema = StandardSchemaV1<unknown, unknown>;

/** Public schema shape exposed when describing a schema-backed service contract. */
export type SchemaDescriptor = AnySchema;

/** Convenience alias for declaring Standard Schema compatible input/output contracts. */
export type Schema<TInput = unknown, TOutput = TInput> = StandardSchemaV1<TInput, TOutput>;

/** Raw caller-facing value type accepted by a schema-backed operation. */
export type InferSchemaInput<TSchema extends AnySchema> = StandardSchemaV1.InferInput<TSchema>;

/** Parsed value type produced by a schema after validation. */
export type InferSchemaOutput<TSchema extends AnySchema> = StandardSchemaV1.InferOutput<TSchema>;

/**
 * Internal utility used to keep handler maps assignable without collapsing everything to `unknown`.
 */
type BivariantCallback<TArgs extends unknown[], TResult> = {
  bivarianceHack(...args: TArgs): TResult;
}['bivarianceHack'];

/** Runtime shape shared by all command collections after they are built. */
export type Command = Record<string, (input: unknown) => Promise<unknown>>;

/**
 * Public runtime shape of a query.
 *
 * Queries are always async and can also be subscribed to for reactive updates.
 */
export type Query<TInput, TOutput> = {
  (input: TInput): Promise<TOutput>;
  subscribe(input: TInput, callback: (value: TOutput) => void): () => void;
};

/** Read-only service handle exposed to query handlers. */
export type ReadonlySelf<TState = unknown> = {
  readonly state: TState;
  queries: Record<string, Query<unknown, unknown>>;
  commands: Command;
};

/** Mutable service handle exposed to command handlers. */
export type WritableSelf<TState = unknown> = ReadonlySelf<TState> & {
  setState(mutate: (draft: TState) => void): void;
};

export type ServiceSummary = {
  id: string;
  description?: string;
  queryNames: string[];
  commandNames: string[];
};

export type QueryDescriptor = {
  name: string;
  description?: string;
  input: SchemaDescriptor;
  output: SchemaDescriptor;
};

export type CommandDescriptor = {
  name: string;
  description?: string;
  input: SchemaDescriptor;
  output: SchemaDescriptor;
};

export type ServiceDescriptor = {
  id: string;
  description?: string;
  queries: Record<string, QueryDescriptor>;
  commands: Record<string, CommandDescriptor>;
};

export interface ServiceRegistryApi {
  listServices(): Promise<ServiceSummary[]>;
  describeService(serviceId: string): Promise<ServiceDescriptor>;
  getService(serviceId: string): Promise<RuntimeService>;
}

/** A resolved service handle exposing only its own queries and commands. */
export type RuntimeService = ServiceInstance<unknown, Queries<unknown>, Commands<unknown>>;

/** Context passed to query handlers and static preload helpers. */
export type QueryCtx<TState> = {
  self: ReadonlySelf<TState>;
  getService: ServiceRegistryApi['getService'];
};

/** Context passed to command handlers. */
export type CommandCtx<TState> = {
  self: WritableSelf<TState>;
  getService: ServiceRegistryApi['getService'];
};

/**
 * Optional static preload metadata for a query.
 *
 * `inputs()` enumerates the raw caller-facing inputs that should be prebuilt, while `path()` can
 * customize which serialized state file receives the resulting state snapshot.
 */
export type QueryStaticDefinition<TState, TInput = unknown, TParsedInput = TInput> = {
  path?: BivariantCallback<[input: TParsedInput, ctx: QueryCtx<TState>], string>;
  inputs: BivariantCallback<[ctx: QueryCtx<TState>], TInput[] | Promise<TInput[]>>;
};

/**
 * Declarative definition for one query.
 *
 * Queries validate caller input, optionally preload state, run against a read-only context, and
 * validate the resolved output before it is returned or emitted.
 */
export type QueryDefinition<
  TState,
  TInputSchema extends AnySchema,
  TOutputSchema extends AnySchema,
> = {
  description?: string;
  input: TInputSchema;
  output: TOutputSchema;
  handler?: (
    input: InferSchemaOutput<TInputSchema>,
    ctx: QueryCtx<TState>
  ) => InferSchemaInput<TOutputSchema> | Promise<InferSchemaInput<TOutputSchema>>;
  preload?: (input: InferSchemaOutput<TInputSchema>, ctx: QueryCtx<TState>) => void | Promise<void>;
  static?: QueryStaticDefinition<
    TState,
    InferSchemaInput<TInputSchema>,
    InferSchemaOutput<TInputSchema>
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
  handler?: (
    input: InferSchemaOutput<TInputSchema>,
    ctx: CommandCtx<TState>
  ) => InferSchemaInput<TOutputSchema> | Promise<InferSchemaInput<TOutputSchema>>;
};

/** Internal structural constraint used to store any query definition in a record. */
export type AnyQueryDefinition<TState> = {
  description?: string;
  input: AnySchema;
  output: AnySchema;
  handler?: BivariantCallback<[input: unknown, ctx: QueryCtx<TState>], unknown | Promise<unknown>>;
  preload?: BivariantCallback<[input: unknown, ctx: QueryCtx<TState>], void | Promise<void>>;
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
  id: string;
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

/** Optional runtime options when creating a service instance. */
export type CreateServiceOptions = {
  store?: StaticStore;
};

/** Internal runtime options when constructing a service runtime directly. */
export type CreateServiceRuntimeOptions = CreateServiceOptions & {
  registryApi: ServiceRegistryApi;
};

export type ServiceQueryRegistration<TState, TQuery extends AnyQueryDefinition<TState>> = Pick<
  TQuery,
  'handler' | 'preload' | 'static'
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
