import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { GetServiceOptions } from './types.ts';

type AnySchema = StandardSchemaV1<unknown, unknown>;

export type ToolsetTransport = 'cli' | 'mcp' | 'sdk';

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
 * method. Absent when the transport has telemetry disabled.
 */
export type ToolsetTelemetry = (event: string, payload: Record<string, unknown>) => Promise<void>;

export type ToolsetCtx = {
  transport: ToolsetTransport;
  /**
   * Storybook UI base URL, including any deployment subpath. Absent when running from a CLI
   * without a live Storybook.
   */
  origin?: string;
  getService: ToolsetGetService;
  telemetry?: ToolsetTelemetry;
};

/**
 * A method description, resolved per transport.
 *
 * The function form exists because descriptions cross-reference sibling methods, and each surface
 * spells those differently (`stories-changed` on MCP, `npx storybook tools stories changed` on
 * the CLI, dotted `toolsetId.methodName` in the SDK). Use `getToolName(ctx)` to render a reference
 * rather than hardcoding a spelling.
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
 * `markdown` may be multiple strings: MCP renders each as its own text block (`stories-preview`
 * renders one block per URL), the CLI joins them with newlines.
 */
export type ToolsetOutcome<TSuccess, TFailure = TSuccess> =
  | {
      readonly ok: true;
      readonly data: TSuccess;
      readonly markdown: string | string[];
    }
  | {
      readonly ok: false;
      readonly data: TFailure;
      readonly markdown: string | string[];
    };

// `any` permits heterogeneous outcome maps. Each individual method remains typed by `defineToolset`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyToolsetOutcome = ToolsetOutcome<any, any>;

/** Output schema for a published toolset method. Must describe a JSON object. */
export type ToolsetObjectOutputSchema = StandardSchemaV1<
  Record<string, unknown>,
  Record<string, unknown>
>;

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
   * `description`, not an invokable tool name.
   */
  title: string;
  description: ToolsetMethodDescription;
  input: TSchema;
  /** Published as the MCP tool's `outputSchema`. Must describe a JSON object. */
  output?: ToolsetObjectOutputSchema;
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

export type ToolsetDefinition<
  TId extends string = string,
  TMethods extends ToolsetMethods = ToolsetMethods,
> = {
  id: TId;
  description: string;
  methods: TMethods;
};

export type AnyToolsetDefinition = ToolsetDefinition;

/**
 * What a handler may return when its method publishes an `output`: outcomes whose `data` —
 * on both branches, since adapters validate failure data into `structuredContent` too — carries at
 * least the schema's declared shape. The open record keeps the data-superset pattern legal: the
 * rendered Markdown may use fields the public contract does not ship. Intersecting with
 * `Record<string, unknown>` keeps handler `data` an object.
 */
type SchemaBoundData<TSchema extends AnySchema> = StandardSchemaV1.InferInput<TSchema> &
  Record<string, unknown>;

type MethodOutcomeContract<TMethod> = TMethod extends {
  output: infer TOut extends AnySchema;
}
  ? ToolsetOutcome<SchemaBoundData<TOut>> | Promise<ToolsetOutcome<SchemaBoundData<TOut>>>
  : unknown;

/**
 * Second contextual-typing pass for the methods literal: `handler` input comes from that method's
 * own `input`, and its outcome data from the method's `output` where one is declared — so
 * renaming or removing a published field is a compile error at the definition site. Intersecting
 * this with the inferred map is what makes the flow work on both the stable and the native
 * TypeScript compiler — inferring a separate record does not.
 */
type MethodContracts<TMethods extends ToolsetMethods> = {
  [TKey in keyof TMethods]: {
    handler: (
      input: StandardSchemaV1.InferOutput<TMethods[TKey]['input']>,
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
  methods: TMethods & MethodContracts<TMethods>;
}): ToolsetDefinition<TId, TMethods> {
  return definition;
}

/** Resolves a method description for one transport. */
export function resolveToolsetDescription(
  description: ToolsetMethodDescription,
  context: ToolsetCtx
): string {
  return typeof description === 'function' ? description(context) : description;
}

/**
 * Reports best-effort telemetry without allowing analytics failures to fail the tool call.
 *
 * Analytics event names (`tool:previewStories`, …) and payload classifiers (`toolset: 'dev' |
 * 'docs' | 'test'`) are a frozen cross-version contract. Keep them aligned with older Storybook
 * releases even when MCP wire tool names or toolset ids change. The channel field is `transport`
 * (`'cli' | 'mcp' | 'sdk'`), matching the toolset API.
 */
export async function reportToolsetTelemetry(
  context: ToolsetCtx,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    await context.telemetry?.(event, payload);
  } catch {
    // Telemetry is never part of the tool's result contract.
  }
}
