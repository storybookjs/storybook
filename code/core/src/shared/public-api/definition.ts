import type { StandardSchemaV1 } from '@standard-schema/spec';

type AnySchema = StandardSchemaV1<unknown, unknown>;

export type ApiConsumer = 'cli' | 'mcp';

export interface ApiInvocationContext {
  consumer?: ApiConsumer;
}

export type ApiMethod<TSchema extends AnySchema = AnySchema> = {
  description: string;
  schema: TSchema;
  handler: (input: StandardSchemaV1.InferOutput<TSchema>, context: ApiInvocationContext) => unknown;
};

// `any` permits a heterogeneous method map. Each individual method remains typed by `defineApi`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiMethods = Record<string, ApiMethod<any>>;

export type ApiDefinition<TId extends string = string, TMethods extends ApiMethods = ApiMethods> = {
  id: TId;
  description: string;
  methods: TMethods;
};

export type AnyApiDefinition = ApiDefinition;

type DefinedApiMethods<TSchemas extends Record<string, AnySchema>> = {
  [TKey in keyof TSchemas]: ApiMethod<TSchemas[TKey]>;
};

export function defineApi<
  const TId extends string,
  const TSchemas extends Record<string, AnySchema>,
>(definition: {
  id: TId;
  description: string;
  methods: DefinedApiMethods<TSchemas>;
}): ApiDefinition<TId, DefinedApiMethods<TSchemas>> {
  return definition;
}
