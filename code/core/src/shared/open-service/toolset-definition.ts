import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { GetServiceOptions } from './types.ts';

type AnySchema = StandardSchemaV1<unknown, unknown>;

export type ToolsetConsumer = 'cli' | 'mcp';

/**
 * Service lookup for toolset handlers. Intentionally not keyed to ServerCoreServices:
 * toolsets may call core OSA (with `{ internal: true }`) or optional addon services by id.
 */
export type ToolsetGetService = {
  <TInstance = unknown>(serviceId: string, options?: GetServiceOptions): TInstance;
};

/**
 * Emits one telemetry event for a toolset method.
 *
 * Adapters supply the sink so surface-specific fields (MCP session id, client info) stay with the
 * adapter while the event name and payload — the part that describes the capability — stay in the
 * method. Absent when the consumer has telemetry disabled.
 */
export type ToolsetTelemetry = (event: string, payload: Record<string, unknown>) => Promise<void>;

export type ToolsetCtx = {
  consumer: ToolsetConsumer;
  /** Storybook server origin. Absent when running from a CLI without a live Storybook. */
  origin?: string;
  /**
   * Where this consumer's Storybook UI is reachable, when that differs from `origin` — a
   * sub-path-hosted dev server answers MCP at `<root><endpoint>` while its UI lives at `<root>`.
   * Methods that link into the UI prefer this over `origin`; the adapter derives it from the
   * request it is serving.
   */
  uiRoot?: string;
  getService: ToolsetGetService;
  telemetry?: ToolsetTelemetry;
};

/**
 * A method description, resolved per consumer.
 *
 * The function form exists because descriptions cross-reference sibling methods, and each surface
 * spells those differently (`get-changed-stories` on MCP, `npx storybook tools stories changed` on
 * the CLI). Use `getRef(ctx)` to render a reference rather than hardcoding either spelling.
 */
export type ToolsetMethodDescription = string | ((context: ToolsetCtx) => string);

/**
 * The result of one method run: the tag, the structured data, and the rendered Markdown, all from a
 * single execution.
 *
 * The failure model in one line each: could not do the job → throw; did the job and the answer is
 * bad news → return `{ ok: false, data, markdown }`. Adapters unwrap mechanically — text blocks
 * from `markdown`, `structuredContent` from `data`, MCP `isError` (and later CLI exit codes) from
 * `ok` — so everything a method means lives on its definition, never re-derived outside it.
 *
 * Declare `TFailure = never` for infallible methods; the signature then documents fallibility and
 * TypeScript narrows both branches. Return plain object literals: contextual typing against this
 * union does the narrowing, no factory helpers needed.
 *
 * `markdown` may be multiple strings: MCP renders each as its own text block (preview-stories
 * renders one block per URL), the CLI joins them with newlines.
 */
export type ToolsetOutcome<TSuccess, TFailure = TSuccess> =
  | { readonly ok: true; readonly data: TSuccess; readonly markdown: string | string[] }
  | { readonly ok: false; readonly data: TFailure; readonly markdown: string | string[] };

// `any` permits heterogeneous outcome maps. Each individual method remains typed by `defineToolset`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyToolsetOutcome = ToolsetOutcome<any, any>;

/**
 * One public method: description, input schema, optional output schema, and one handler.
 *
 * The handler produces the whole {@link ToolsetOutcome} — data, side effects, telemetry, and the
 * rendered Markdown — because one MCP response carries `content` (text) and `structuredContent`
 * (JSON) at once, and both must come from a single run: re-running a method with side effects
 * would repeat them. Usage telemetry reports inline in the handler, with the rendered text in
 * hand, so no consumer can forget it.
 */
export type ToolsetMethod<
  TSchema extends AnySchema = AnySchema,
  TOutcome extends AnyToolsetOutcome = AnyToolsetOutcome,
> = {
  /**
   * Short display label shown by client UIs (e.g. an MCP client's tool list). Editable prose like
   * `description`, not a frozen contract — the invokable tool name lives in `MCP_TOOL_NAMES`.
   */
  title: string;
  description: ToolsetMethodDescription;
  schema: TSchema;
  /** Published as the MCP tool's `outputSchema`. Declare it only where the JSON is contractual. */
  outputSchema?: AnySchema;
  /**
   * Marks a method that can only do its job against a running Storybook dev server — because it
   * needs a live origin for its URLs or reads state only the dev server owns. Consumers that run
   * without one (the `storybook tools` CLI) surface these methods behind one uniform contract:
   * start the dev server first. Adapters that always have a dev server (MCP) ignore the trait.
   */
  requiresDevServer?: true;
  handler: (
    input: StandardSchemaV1.InferOutput<TSchema>,
    context: ToolsetCtx
  ) => TOutcome | Promise<TOutcome>;
};

// `any` permits reading one method out of a heterogeneous method map, e.g. by a consumer that
// dispatches over `AnyToolsetDefinition`. Each individual method remains typed by `defineToolset`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyToolsetMethod = ToolsetMethod<any, AnyToolsetOutcome>;

type ToolsetMethods = Record<string, AnyToolsetMethod>;

/**
 * Which surface group a toolset's telemetry reports under. Part of the definition — not adapter
 * wiring — so the grouping cannot drift between consumers. Stories and review report under `dev`.
 */
export type ToolsetTelemetryGroup = 'dev' | 'test' | 'docs';

export type ToolsetDefinition<
  TId extends string = string,
  TMethods extends ToolsetMethods = ToolsetMethods,
> = {
  id: TId;
  description: string;
  telemetryGroup: ToolsetTelemetryGroup;
  methods: TMethods;
};

export type AnyToolsetDefinition = ToolsetDefinition;

/**
 * What a handler may return when its method publishes an `outputSchema`: outcomes whose `data` —
 * on both branches, since adapters validate failure data into `structuredContent` too — carries at
 * least the schema's declared shape. The open record keeps the data-superset pattern legal: the
 * rendered Markdown may use fields the public contract does not ship. The schema's *input* type is
 * the right side of the contract, because that is what the adapters' runtime validation accepts.
 */
type SchemaBoundData<TSchema extends AnySchema> = StandardSchemaV1.InferInput<TSchema> &
  Record<string, unknown>;

type MethodOutcomeContract<TMethod> = TMethod extends { outputSchema: infer TOut extends AnySchema }
  ? ToolsetOutcome<SchemaBoundData<TOut>> | Promise<ToolsetOutcome<SchemaBoundData<TOut>>>
  : unknown;

/**
 * Second contextual-typing pass for the methods literal: `handler` input comes from that method's
 * own `schema`, and its outcome data from the method's `outputSchema` where one is declared — so
 * renaming or removing a published field is a compile error at the definition site. Intersecting
 * this with the inferred map is what makes the flow work on both the stable and the native
 * TypeScript compiler — inferring a separate record does not.
 */
type MethodContracts<TMethods extends ToolsetMethods> = {
  [TKey in keyof TMethods]: {
    handler: (
      input: StandardSchemaV1.InferOutput<TMethods[TKey]['schema']>,
      context: ToolsetCtx
    ) => MethodOutcomeContract<TMethods[TKey]>;
  };
};

export function defineToolset<
  const TId extends string,
  const TMethods extends ToolsetMethods,
>(definition: {
  id: TId;
  description: string;
  telemetryGroup: ToolsetTelemetryGroup;
  methods: TMethods & MethodContracts<TMethods>;
}): ToolsetDefinition<TId, TMethods> {
  return definition;
}

/** Resolves a method description for one consumer. */
export function resolveToolsetDescription(
  description: ToolsetMethodDescription,
  context: ToolsetCtx
): string {
  return typeof description === 'function' ? description(context) : description;
}
