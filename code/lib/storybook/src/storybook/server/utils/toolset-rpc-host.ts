import { logger } from '@storybook/core/internal/node-logger';
import { telemetry } from '@storybook/core/internal/telemetry';
import type { ChannelLike } from '@storybook/core/internal/channels';

import {
  invokeToolsetMethod,
  parseToolsetMethodId,
  type AnyToolsetDefinition,
  type InvokedToolsetOutcome,
  type ToolsetBaseCtx,
  type ToolsetGetService,
} from '@storybook/core/open-service';
import {
  TOOLSET_CALL_ACK,
  TOOLSET_CALL_CANCEL,
  TOOLSET_CALL_ERROR,
  TOOLSET_CALL_INVOKE,
  TOOLSET_CALL_RESULT,
  TOOLSET_DESCRIBE,
  TOOLSET_DESCRIBE_ERROR,
  TOOLSET_DESCRIBE_RESULT,
  TOOLSET_TELEMETRY,
  TOOLSET_TELEMETRY_ACK,
  toToolsetRpcError,
  toolsetCallCancelSchema,
  toolsetCallInvokeSchema,
  toolsetDescribeSchema,
  toolsetTelemetrySchema,
  type ToolsetTelemetryAckPayload,
  type ToolsetCallAckPayload,
  type ToolsetCallInvokePayload,
  type ToolsetCallResultPayload,
  type ToolsetDescribeResultPayload,
  type ToolsetRpcCatalog,
} from '@storybook/core/internal/deep/shared/open-service/toolset-rpc';
import { formatIssues } from '@storybook/core/internal/deep/shared/open-service/errors';
import * as v from '@storybook/core/internal/deep/utils/valibot';
import { ToolsRuntimeError } from '@storybook/open-service';
import { toCatalogEntry } from '@storybook/open-service/internal';

export type ToolsetRpcHostOptions = {
  channel: Pick<ChannelLike, 'on' | 'off' | 'emit'>;
  /** The host instance's registered toolsets, read per request so late registrations show. */
  toolsets: () => AnyToolsetDefinition[];
  getService: ToolsetGetService;
  /** The dev server's own base URL, including any deployment subpath. */
  origin: string;
  configDir: string;
  /** Sends a client's `tools-command` record; defaults to Storybook telemetry. */
  sendTelemetry?: (payload: Record<string, unknown>, configDir: string) => Promise<void>;
};

type ValidationIssue = {
  message: string;
  path?: ReadonlyArray<PropertyKey | { key?: unknown }>;
};

/**
 * Serves the toolset RPC on the dev server channel: attached tools clients describe and call the
 * host instance's toolsets here instead of loading the project themselves.
 *
 * Calls fire no telemetry here. The client composes the one `tools-command` record per run and
 * sends it as `toolsets:telemetry`; the host records it under its own project configuration, so
 * the opt-out applies without the client loading `main.ts`.
 *
 * @returns A teardown that stops listening and aborts calls still running.
 */
export function serveToolsetRpc(options: ToolsetRpcHostOptions): () => void {
  const { channel, origin, configDir, getService } = options;
  const running = new Map<string, AbortController>();

  const contextFor = (
    transport: ToolsetBaseCtx['transport'],
    originOverride?: string
  ): ToolsetBaseCtx => ({
    transport,
    origin: originOverride ?? origin,
    getService,
  });

  const onDescribe = (payload: unknown): void => {
    const parsed = v.safeParse(toolsetDescribeSchema, payload);
    if (!parsed.success) {
      return;
    }
    const { callId, clientInfo, toolset } = parsed.output;
    try {
      const all = options.toolsets();
      const selected = toolset === undefined ? all : [findToolset(all, toolset, configDir)];
      const ctx = contextFor(clientInfo.transport);
      const catalog = {
        configDir,
        toolsets: selected.map((entry) => toCatalogEntry(entry, ctx)),
      } as ToolsetRpcCatalog;
      channel.emit(TOOLSET_DESCRIBE_RESULT, {
        callId,
        catalog,
      } satisfies ToolsetDescribeResultPayload);
    } catch (error) {
      channel.emit(TOOLSET_DESCRIBE_ERROR, toToolsetRpcError(callId, error));
    }
  };

  const onInvoke = (payload: unknown): void => {
    const parsed = v.safeParse(toolsetCallInvokeSchema, payload);
    if (!parsed.success || running.has(parsed.output.callId)) {
      return;
    }
    const invoke = parsed.output;
    const controller = new AbortController();
    running.set(invoke.callId, controller);
    channel.emit(TOOLSET_CALL_ACK, { callId: invoke.callId } satisfies ToolsetCallAckPayload);
    logger.debug(
      `Toolset RPC: running ${invoke.methodId} for ${invoke.clientInfo.name} (${invoke.clientInfo.transport})`
    );

    // A macrotask, so the ack reaches the socket before a long synchronous handler prefix runs.
    setTimeout(() => {
      void raceAbort(controller.signal, () => runInvoke(invoke, controller.signal))
        .then(
          (outcome) => {
            channel.emit(TOOLSET_CALL_RESULT, {
              callId: invoke.callId,
              outcome,
            } satisfies ToolsetCallResultPayload);
          },
          (error: unknown) => {
            channel.emit(TOOLSET_CALL_ERROR, toToolsetRpcError(invoke.callId, error));
          }
        )
        .finally(() => {
          running.delete(invoke.callId);
        });
    }, 0);
  };

  const onCancel = (payload: unknown): void => {
    const parsed = v.safeParse(toolsetCallCancelSchema, payload);
    if (parsed.success) {
      running.get(parsed.output.callId)?.abort();
    }
  };

  // The dev server outlives the client, so the record is confirmed before it leaves the process.
  const onTelemetry = (payload: unknown): void => {
    const parsed = v.safeParse(toolsetTelemetrySchema, payload);
    if (!parsed.success) {
      return;
    }
    channel.emit(TOOLSET_TELEMETRY_ACK, {
      callId: parsed.output.callId,
    } satisfies ToolsetTelemetryAckPayload);
    void (options.sendTelemetry ?? sendToolsCommandRecord)(parsed.output.payload, configDir);
  };

  const runInvoke = async (
    invoke: ToolsetCallInvokePayload,
    signal: AbortSignal
  ): Promise<InvokedToolsetOutcome> => {
    const toolsets = options.toolsets();
    const { toolsetId, methodName } = parseRef(invoke.methodId);
    const toolset = findToolset(toolsets, toolsetId, configDir);
    if (!Object.hasOwn(toolset.methods, methodName)) {
      throw new ToolsRuntimeError({
        reason: 'unknown-method',
        message: `Unknown tool \`${toolset.id}.${methodName}\`. The \`${toolset.id}\` toolset provides: ${Object.keys(toolset.methods).join(', ')}.`,
      });
    }
    const method = toolset.methods[methodName];
    const validation = await method.input['~standard'].validate(invoke.input ?? {});
    if (validation.issues) {
      throw new ToolsRuntimeError({
        reason: 'invalid-input',
        message: `Invalid input for \`${invoke.methodId}\`:\n${formatIssues(validation.issues)}`,
        issues: validation.issues.map((issue: ValidationIssue) => ({
          message: issue.message,
          ...(issue.path ? { path: issue.path.map(toPathKey) } : {}),
        })),
      });
    }
    return invokeToolsetMethod(toolset, methodName, validation.value, {
      ...contextFor(invoke.clientInfo.transport, invoke.origin),
      signal,
    });
  };

  channel.on(TOOLSET_DESCRIBE, onDescribe);
  channel.on(TOOLSET_CALL_INVOKE, onInvoke);
  channel.on(TOOLSET_CALL_CANCEL, onCancel);
  channel.on(TOOLSET_TELEMETRY, onTelemetry);

  return () => {
    channel.off(TOOLSET_DESCRIBE, onDescribe);
    channel.off(TOOLSET_CALL_INVOKE, onInvoke);
    channel.off(TOOLSET_CALL_CANCEL, onCancel);
    channel.off(TOOLSET_TELEMETRY, onTelemetry);
    for (const controller of running.values()) {
      controller.abort();
    }
    running.clear();
  };
}

async function sendToolsCommandRecord(
  payload: Record<string, unknown>,
  configDir: string
): Promise<void> {
  try {
    await telemetry('tools-command', payload, { configDir });
  } catch {
    // Telemetry is never part of a tool's result contract.
  }
}

function parseRef(ref: string): { toolsetId: string; methodName: string } {
  try {
    return parseToolsetMethodId(ref);
  } catch {
    throw new ToolsRuntimeError({
      reason: 'unknown-method',
      message: `Invalid tool reference \`${ref}\`. Expected \`toolsetId.methodName\`.`,
    });
  }
}

function findToolset(
  toolsets: AnyToolsetDefinition[],
  toolsetId: string,
  configDir: string
): AnyToolsetDefinition {
  const toolset = toolsets.find((candidate) => candidate.id === toolsetId);
  if (!toolset) {
    throw new ToolsRuntimeError({
      reason: 'unknown-toolset',
      message: `Unknown toolset \`${toolsetId}\`. The Storybook configuration at ${configDir} provides: ${toolsets.map((candidate) => candidate.id).join(', ')}.`,
    });
  }
  return toolset;
}

/** Issue path segments as JSON-safe keys; valibot segments also carry the raw input. */
function toPathKey(segment: PropertyKey | { key?: unknown }): { key: string | number } {
  const key = typeof segment === 'object' && segment !== null ? segment.key : segment;
  return { key: typeof key === 'number' ? key : String(key) };
}

async function raceAbort<T>(signal: AbortSignal, work: () => Promise<T>): Promise<T> {
  signal.throwIfAborted();
  let onAbort!: () => void;
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
  });
  return Promise.race([work(), aborted]).finally(() => {
    signal.removeEventListener('abort', onAbort);
  });
}
