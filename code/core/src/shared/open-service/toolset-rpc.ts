/**
 * Wire protocol for running toolset methods on a dev server on behalf of an attached client.
 *
 * It mirrors the service-command protocol in `service-transport.ts`: a requester emits an invoke
 * with a fresh `callId`, the host acknowledges at once, then replies with a result or a serialized
 * error. Only the message shapes live here, so a client can speak the protocol without importing
 * the host.
 */
import { nanoid } from 'nanoid';
import * as v from 'valibot';

import { isPlainObject } from './plain-object.ts';
import {
  deserializeError,
  serializeError,
  type SerializedError,
} from './service-error-serialization.ts';

export type ToolsetRpcCatalogMethod = {
  ref: `${string}.${string}`;
  title: string;
  description: string;
  requiresDevServer: boolean;
  input: Record<string, unknown> | undefined;
  output?: Record<string, unknown>;
};

export type ToolsetRpcCatalogEntry = {
  id: string;
  description: string;
  methods: ToolsetRpcCatalogMethod[];
};

/** The host's toolsets with JSON Schema inputs, resolved for the requester's transport. */
export type ToolsetRpcCatalog = {
  configDir: string;
  toolsets: ToolsetRpcCatalogEntry[];
};

/**
 * Version of this protocol. A dev server advertises it in its instance record (`toolsetRpc`);
 * a client speaks the protocol only on an exact match and otherwise attaches the older way.
 */
export const TOOLSET_RPC_PROTOCOL_VERSION = 1;

/** Window for the host to acknowledge a call; the handler itself may run much longer. */
export const TOOLSET_RPC_ACK_TIMEOUT_MS = 5_000;

/** Window for the host to answer a describe request. */
export const TOOLSET_RPC_DESCRIBE_TIMEOUT_MS = 10_000;

/** Window for the host to confirm a telemetry record; a miss drops the record, never the run. */
export const TOOLSET_RPC_TELEMETRY_TIMEOUT_MS = 1_000;

export const TOOLSET_DESCRIBE = 'toolsets:describe' as const;
export const TOOLSET_DESCRIBE_RESULT = 'toolsets:describe-result' as const;
export const TOOLSET_DESCRIBE_ERROR = 'toolsets:describe-error' as const;
export const TOOLSET_CALL_INVOKE = 'toolsets:call-invoke' as const;
export const TOOLSET_CALL_ACK = 'toolsets:call-ack' as const;
export const TOOLSET_CALL_RESULT = 'toolsets:call-result' as const;
export const TOOLSET_CALL_ERROR = 'toolsets:call-error' as const;
export const TOOLSET_CALL_CANCEL = 'toolsets:call-cancel' as const;
export const TOOLSET_TELEMETRY = 'toolsets:telemetry' as const;
export const TOOLSET_TELEMETRY_ACK = 'toolsets:telemetry-ack' as const;

/** Events only an attached tools client may send; browser pages never speak them. */
export const TOOLSET_RPC_REQUEST_EVENTS: readonly string[] = [
  TOOLSET_DESCRIBE,
  TOOLSET_CALL_INVOKE,
  TOOLSET_CALL_CANCEL,
  TOOLSET_TELEMETRY,
];

const transportSchema = v.picklist(['cli', 'mcp', 'sdk']);

const plainObjectSchema = v.custom<Record<string, unknown>>(isPlainObject);

const serializedErrorSchema = v.custom<SerializedError>(isPlainObject);

/** Identifies the requester, so the host resolves descriptions and reports for its surface. */
export const toolsetRpcClientSchema = v.object({
  name: v.string(),
  version: v.string(),
  transport: transportSchema,
});
export type ToolsetRpcClient = v.InferOutput<typeof toolsetRpcClientSchema>;

export const toolsetDescribeSchema = v.object({
  callId: v.string(),
  clientInfo: toolsetRpcClientSchema,
  toolset: v.optional(v.string()),
});
export type ToolsetDescribePayload = v.InferOutput<typeof toolsetDescribeSchema>;

export const toolsetDescribeResultSchema = v.object({
  callId: v.string(),
  catalog: v.custom<ToolsetRpcCatalog>(
    (value) => isPlainObject(value) && Array.isArray(value.toolsets)
  ),
});
export type ToolsetDescribeResultPayload = v.InferOutput<typeof toolsetDescribeResultSchema>;

export const toolsetDescribeErrorSchema = v.object({
  callId: v.string(),
  error: serializedErrorSchema,
});
export type ToolsetDescribeErrorPayload = v.InferOutput<typeof toolsetDescribeErrorSchema>;

/** `input` is unvalidated here; the host validates it against the method's own schema. */
export const toolsetCallInvokeSchema = v.object({
  callId: v.string(),
  methodId: v.string(),
  input: v.optional(plainObjectSchema),
  clientInfo: toolsetRpcClientSchema,
  /** Overrides the host's own origin for this call. */
  origin: v.optional(v.string()),
});
export type ToolsetCallInvokePayload = v.InferOutput<typeof toolsetCallInvokeSchema>;

export const toolsetCallAckSchema = v.object({ callId: v.string() });
export type ToolsetCallAckPayload = v.InferOutput<typeof toolsetCallAckSchema>;

/** `outcome` is the `InvokedToolsetOutcome` as JSON; image paths stay absolute host paths. */
export const toolsetCallResultSchema = v.object({
  callId: v.string(),
  outcome: v.custom<Record<string, unknown>>(
    (value) => isPlainObject(value) && typeof value.ok === 'boolean'
  ),
});
export type ToolsetCallResultPayload = v.InferOutput<typeof toolsetCallResultSchema>;

export const toolsetCallErrorSchema = v.object({
  callId: v.string(),
  error: serializedErrorSchema,
});
export type ToolsetCallErrorPayload = v.InferOutput<typeof toolsetCallErrorSchema>;

export const toolsetCallCancelSchema = v.object({ callId: v.string() });
export type ToolsetCallCancelPayload = v.InferOutput<typeof toolsetCallCancelSchema>;

/**
 * A `tools-command` record the client composed for one run. The host sends it with its own
 * project configuration, so the client never loads that configuration to honor the opt-out.
 */
export const toolsetTelemetrySchema = v.object({
  callId: v.string(),
  payload: plainObjectSchema,
});
export type ToolsetTelemetryPayload = v.InferOutput<typeof toolsetTelemetrySchema>;

export const toolsetTelemetryAckSchema = v.object({ callId: v.string() });
export type ToolsetTelemetryAckPayload = v.InferOutput<typeof toolsetTelemetryAckSchema>;

/** Unique id for one describe or call; replies correlate on it. */
export function generateToolsetCallId(): string {
  return nanoid();
}

/** Builds a describe or call error reply; the thrown value keeps its fields and `cause` chain. */
export function toToolsetRpcError(callId: string, error: unknown): ToolsetCallErrorPayload {
  return { callId, error: serializeError(error) };
}

/** Rebuilds the error a host sent; the result is a plain `Error` carrying the original fields. */
export function fromToolsetRpcError(payload: { error: SerializedError }): Error {
  return deserializeError(payload.error);
}
