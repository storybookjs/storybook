import type { StandardSchemaV1 } from '@standard-schema/spec';

import { toCliMethodName } from './toolset-names.ts';
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

export type ToolsetCtx = {
  transport: ToolsetTransport;
  /**
   * Storybook UI base URL, including any deployment subpath. Absent when running from a CLI
   * without a live Storybook.
   */
  origin?: string;
  getService: ToolsetGetService;
};

/**
 * A handler's usage report: the payload describing what the call did, counts and flags alike. It
 * travels on the outcome, so a handler reports at most once and in the same object as its data.
 * The surface that ran the method turns it into its own telemetry record and names the event; a
 * handler never names one.
 */
export type ToolsetTelemetryReport = { payload: Record<string, unknown> };

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
 * The result of one method run: the tag, the structured data, the rendered Markdown, and the usage
 * report, all from a single execution.
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
export type ToolsetOutcome<
  TSuccess,
  TFailure = TSuccess,
  TReport extends ToolsetTelemetryReport = ToolsetTelemetryReport,
> =
  | {
      readonly ok: true;
      readonly data: TSuccess;
      readonly markdown: string | string[];
      readonly telemetry?: TReport;
    }
  | {
      readonly ok: false;
      readonly data: TFailure;
      readonly markdown: string | string[];
      readonly telemetry?: TReport;
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
 * The handler produces the whole {@link ToolsetOutcome} — data, side effects, the usage report,
 * and the rendered Markdown — because one MCP response carries `content` (text) and
 * `structuredContent` (JSON) at once, and both must come from a single run: re-running a method
 * with side effects would repeat them. The usage report is part of the returned object, with the
 * rendered text in hand, so no consumer can forget it.
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
 * A handler's report completed from where the method is registered: the CLI spelling of the
 * invoked names (`stories`, `find-by-component`) and the generated event name
 * (`tool:stories_findByComponent`).
 */
export type ToolsetMethodReport = ToolsetTelemetryReport & {
  toolset: string;
  tool: string;
  event: string;
};

// `any` for the same reason as {@link AnyToolsetOutcome}: surfaces dispatch over every method.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type InvokedToolsetOutcome = ToolsetOutcome<any, any, ToolsetMethodReport>;

/**
 * Runs one method the way every surface does. The report is named after the registration, never
 * by the handler, so a method cannot report a toolset that disagrees with where it lives. Every
 * surface forwards the report as is and adds only its own fields.
 */
export async function invokeToolsetMethod(
  toolset: AnyToolsetDefinition,
  methodName: string,
  input: unknown,
  context: ToolsetCtx
): Promise<InvokedToolsetOutcome> {
  const { telemetry, ...outcome } = await toolset.methods[methodName].handler(input, context);
  if (!telemetry) {
    return outcome;
  }
  return {
    ...outcome,
    telemetry: {
      ...telemetry,
      toolset: toolset.id,
      tool: toCliMethodName(methodName),
      event: `tool:${toolset.id}_${methodName}`,
    },
  };
}
