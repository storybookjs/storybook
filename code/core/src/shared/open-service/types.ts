export type StaticStore = Record<string, unknown>;

export type Command = Record<string, (input: any) => Promise<void>>;

export type Query<TInput, TOutput> = {
  (input: TInput): Promise<TOutput>;
  subscribe(input: TInput, callback: (value: TOutput) => void): () => void;
};

export type ReadonlySelf<TState = any> = {
  readonly state: TState;
  queries: Record<string, Query<any, any>>;
  commands: Command;
};

export type WritableSelf<TState = any> = ReadonlySelf<TState> & {
  setState(mutate: (draft: TState) => void): void;
};

export type QueryCtx<TState> = {
  self: ReadonlySelf<TState>;
};

export type CommandCtx<TState> = {
  self: WritableSelf<TState>;
};

export type QueryStaticDefinition<TState, TInput> = {
  path?: (input: TInput, ctx: QueryCtx<TState>) => string;
  inputs: (ctx: QueryCtx<TState>) => TInput[] | Promise<TInput[]>;
};

export type QueryDefinition<TState, TInput, TOutput> = {
  handler: (input: TInput, ctx: QueryCtx<TState>) => TOutput;
  preload?: (input: TInput, ctx: QueryCtx<TState>) => void | Promise<void>;
  static?: QueryStaticDefinition<TState, TInput>;
};

export type CommandDefinition<TState, TInput> = {
  handler: (input: TInput, ctx: CommandCtx<TState>) => void | Promise<void>;
};

export type Queries<TState> = Record<string, QueryDefinition<TState, any, any>>;
export type Commands<TState> = Record<string, CommandDefinition<TState, any>>;

export type ServiceDefinition<
  TState,
  TQueries extends Queries<TState>,
  TCommands extends Commands<TState>,
> = {
  id: string;
  initialState: TState;
  queries: TQueries;
  commands: TCommands;
};

export type ServiceInstance<
  TState,
  TQueries extends Queries<TState>,
  TCommands extends Commands<TState>,
> = {
  queries: {
    [TKey in keyof TQueries]: TQueries[TKey] extends QueryDefinition<
      TState,
      infer TInput,
      infer TOutput
    >
      ? Query<TInput, TOutput>
      : never;
  };
  commands: {
    [TKey in keyof TCommands]: TCommands[TKey] extends CommandDefinition<TState, infer TInput>
      ? (input: TInput) => Promise<void>
      : never;
  };
};

export type CreateServiceOptions = {
  store?: StaticStore;
};

export type BuildTaskResult = {
  path: string;
  state: unknown;
};
