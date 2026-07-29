import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { GetServiceOptions } from './types.ts';

type AnySchema = StandardSchemaV1<unknown, unknown>;

export type ToolsetConsumer = 'cli' | 'mcp';

/**
 * Output representation requested by the adapter. Methods never declare the format themselves;
 * adapters own the mapping (CLI `--json` flag, MCP `json` tool input).
 */
export type ToolsetFormat = 'markdown' | 'json';

/**
 * Service lookup for toolset handlers. Intentionally not keyed to ServerCoreServices:
 * toolsets may call core OSA (with `{ internal: true }`) or optional addon services by id.
 */
export type ToolsetGetService = {
  <TInstance = unknown>(serviceId: string, options?: GetServiceOptions): TInstance;
};

export type ToolsetCtx = {
  consumer: ToolsetConsumer;
  /** Storybook server origin. Absent when running from a CLI without a live Storybook. */
  origin?: string;
  format: ToolsetFormat;
  getService: ToolsetGetService;
};

export type ToolsetMethod<TSchema extends AnySchema = AnySchema> = {
  description: string;
  schema: TSchema;
  handler: (input: StandardSchemaV1.InferOutput<TSchema>, context: ToolsetCtx) => unknown;
};

// `any` permits a heterogeneous method map. Each individual method remains typed by `defineToolset`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolsetMethods = Record<string, ToolsetMethod<any>>;

export type ToolsetDefinition<
  TId extends string = string,
  TMethods extends ToolsetMethods = ToolsetMethods,
> = {
  id: TId;
  description: string;
  methods: TMethods;
};

export type AnyToolsetDefinition = ToolsetDefinition;

type DefinedToolsetMethods<TSchemas extends Record<string, AnySchema>> = {
  [TKey in keyof TSchemas]: ToolsetMethod<TSchemas[TKey]>;
};

export function defineToolset<
  const TId extends string,
  const TSchemas extends Record<string, AnySchema>,
>(definition: {
  id: TId;
  description: string;
  methods: DefinedToolsetMethods<TSchemas>;
}): ToolsetDefinition<TId, DefinedToolsetMethods<TSchemas>> {
  return definition;
}
