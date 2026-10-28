import { resolve } from 'pathe';

import { Channel, type ChannelLike } from '@storybook/core/internal/channels';
import { versions } from '@storybook/core/internal/common';

import {
  TOOLSET_CALL_ACK,
  TOOLSET_CALL_CANCEL,
  TOOLSET_CALL_ERROR,
  TOOLSET_CALL_INVOKE,
  TOOLSET_CALL_RESULT,
  TOOLSET_DESCRIBE,
  TOOLSET_DESCRIBE_ERROR,
  TOOLSET_DESCRIBE_RESULT,
  TOOLSET_RPC_ACK_TIMEOUT_MS,
  TOOLSET_RPC_DESCRIBE_TIMEOUT_MS,
  TOOLSET_RPC_TELEMETRY_TIMEOUT_MS,
  TOOLSET_TELEMETRY,
  TOOLSET_TELEMETRY_ACK,
  generateToolsetCallId,
  toolsetTelemetryAckSchema,
  type ToolsetTelemetryPayload,
  toolsetCallAckSchema,
  toolsetCallErrorSchema,
  toolsetCallResultSchema,
  toolsetDescribeErrorSchema,
  toolsetDescribeResultSchema,
  type ToolsetCallCancelPayload,
  type ToolsetCallInvokePayload,
  type ToolsetDescribePayload,
  type ToolsetRpcClient,
} from '@storybook/core/internal/deep/shared/open-service/toolset-rpc';
import * as v from '@storybook/core/internal/deep/utils/valibot';
import type { InvokedToolsetOutcome } from '@storybook/core/open-service';
import {
  reportSdkInvocation,
  withToolsTelemetrySink,
  type ToolsTelemetrySink,
} from './command-telemetry.ts';
import { ToolsRuntimeError, rehydrateSerializedToolsError } from './errors.ts';
import type { StorybookInstanceRecord } from './instances/types.ts';
import type { NodeChannelConnection } from './node-channel.ts';
import type {
  AttachedTools,
  ToolsCallOptions,
  ToolsClientInfo,
  ToolsDescribeOptions,
  ToolsMode,
  ToolsSiblingInstance,
  ToolsetCatalog,
} from './types.ts';

/** Injectable dependencies for tests. */
export type RemoteToolsDeps = {
  ackTimeoutMs?: number;
  describeTimeoutMs?: number;
  telemetryTimeoutMs?: number;
};

type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  timer?: ReturnType<typeof setTimeout>;
};

/**
 * A thin attached host: `describe` and `call` run on the dev server over the toolset RPC, so this
 * process loads no configuration and creates no Storybook instance.
 */
export function createRemoteTools(
  args: {
    record: StorybookInstanceRecord;
    siblings: ToolsSiblingInstance[];
    connection: Pick<NodeChannelConnection, 'transport' | 'close' | 'disconnected'>;
    clientInfo: Required<ToolsClientInfo>;
    requestedMode: ToolsMode;
  },
  deps: RemoteToolsDeps = {}
): AttachedTools {
  const { record, connection, clientInfo, requestedMode } = args;
  const ackTimeoutMs = deps.ackTimeoutMs ?? TOOLSET_RPC_ACK_TIMEOUT_MS;
  const describeTimeoutMs = deps.describeTimeoutMs ?? TOOLSET_RPC_DESCRIBE_TIMEOUT_MS;
  const telemetryTimeoutMs = deps.telemetryTimeoutMs ?? TOOLSET_RPC_TELEMETRY_TIMEOUT_MS;
  const configDir = record.configDir ?? resolve(record.cwd, '.storybook');
  const rpcClient: ToolsetRpcClient = {
    name: clientInfo.name,
    version: clientInfo.version,
    transport: clientInfo.kind === 'cli' ? 'cli' : 'sdk',
  };
  const channel: Pick<ChannelLike, 'on' | 'off' | 'emit'> = new Channel({
    transport: connection.transport,
  });
  const pending = new Map<string, Pending>();
  let closed = false;

  const settle = (callId: string, apply: (entry: Pending) => void): void => {
    const entry = pending.get(callId);
    if (!entry) {
      return;
    }
    pending.delete(callId);
    clearTimeout(entry.timer);
    apply(entry);
  };

  const failAll = (error: unknown): void => {
    for (const callId of [...pending.keys()]) {
      settle(callId, (entry) => entry.reject(error));
    }
  };

  const disconnected = connection.disconnected.catch((cause: unknown) => {
    const error = new ToolsRuntimeError({
      reason: 'connection-lost',
      message: cause instanceof Error ? cause.message : String(cause),
      cause,
    });
    failAll(error);
    throw error;
  });
  void disconnected.catch(() => {});

  const listeners: Array<[string, (payload: unknown) => void]> = [
    [
      TOOLSET_DESCRIBE_RESULT,
      (payload) => {
        const parsed = v.safeParse(toolsetDescribeResultSchema, payload);
        if (parsed.success) {
          settle(parsed.output.callId, (entry) => entry.resolve(parsed.output.catalog));
        }
      },
    ],
    [
      TOOLSET_DESCRIBE_ERROR,
      (payload) => {
        const parsed = v.safeParse(toolsetDescribeErrorSchema, payload);
        if (parsed.success) {
          settle(parsed.output.callId, (entry) =>
            entry.reject(rehydrateSerializedToolsError(parsed.output.error))
          );
        }
      },
    ],
    [
      TOOLSET_TELEMETRY_ACK,
      (payload) => {
        const parsed = v.safeParse(toolsetTelemetryAckSchema, payload);
        if (parsed.success) {
          settle(parsed.output.callId, (entry) => entry.resolve(undefined));
        }
      },
    ],
    [
      TOOLSET_CALL_ACK,
      (payload) => {
        const parsed = v.safeParse(toolsetCallAckSchema, payload);
        const entry = parsed.success ? pending.get(parsed.output.callId) : undefined;
        if (entry) {
          clearTimeout(entry.timer);
        }
      },
    ],
    [
      TOOLSET_CALL_RESULT,
      (payload) => {
        const parsed = v.safeParse(toolsetCallResultSchema, payload);
        if (parsed.success) {
          settle(parsed.output.callId, (entry) => entry.resolve(parsed.output.outcome));
        }
      },
    ],
    [
      TOOLSET_CALL_ERROR,
      (payload) => {
        const parsed = v.safeParse(toolsetCallErrorSchema, payload);
        if (parsed.success) {
          settle(parsed.output.callId, (entry) =>
            entry.reject(rehydrateSerializedToolsError(parsed.output.error))
          );
        }
      },
    ],
  ];
  for (const [event, listener] of listeners) {
    channel.on(event, listener);
  }

  const assertOpen = (): void => {
    if (closed) {
      throw closedError();
    }
  };

  /** Emits one request and waits for its reply; `timeoutMs` bounds the wait for any answer. */
  const request = (
    callId: string,
    send: () => void,
    timeout: { ms: number; message: string }
  ): Promise<unknown> =>
    Promise.race([
      new Promise<unknown>((resolveRequest, rejectRequest) => {
        const timer = setTimeout(() => {
          settle(callId, (entry) =>
            entry.reject(
              new ToolsRuntimeError({ reason: 'command-unhandled', message: timeout.message })
            )
          );
        }, timeout.ms);
        pending.set(callId, { resolve: resolveRequest, reject: rejectRequest, timer });
        send();
      }),
      disconnected,
    ]);

  const invoke = async (
    ref: string,
    input: Record<string, unknown>,
    options: ToolsCallOptions
  ): Promise<InvokedToolsetOutcome> => {
    options.signal?.throwIfAborted();
    const callId = generateToolsetCallId();
    let onAbort: (() => void) | undefined;
    const aborted = options.signal
      ? new Promise<never>((_, reject) => {
          onAbort = () => {
            settle(callId, () => {});
            channel.emit(TOOLSET_CALL_CANCEL, { callId } satisfies ToolsetCallCancelPayload);
            reject(options.signal!.reason);
          };
          options.signal!.addEventListener('abort', onAbort, { once: true });
        })
      : undefined;
    const work = request(
      callId,
      () =>
        channel.emit(TOOLSET_CALL_INVOKE, {
          callId,
          methodId: ref,
          input,
          clientInfo: rpcClient,
          ...(options.origin !== undefined ? { origin: options.origin } : {}),
        } satisfies ToolsetCallInvokePayload),
      {
        ms: ackTimeoutMs,
        message: `The Storybook at ${record.url} did not acknowledge \`${ref}\` in time. It may be busy; the tool may still have run there. Retry, or restart that Storybook if this persists.`,
      }
    );
    try {
      return (await (aborted ? Promise.race([work, aborted]) : work)) as InvokedToolsetOutcome;
    } finally {
      if (onAbort) {
        options.signal?.removeEventListener('abort', onAbort);
      }
    }
  };

  // The dev server records the run under its own configuration; nothing here calls `telemetry()`.
  const sendTelemetry: ToolsTelemetrySink = async (payload) => {
    if (closed) {
      return;
    }
    const callId = generateToolsetCallId();
    await request(
      callId,
      () =>
        channel.emit(TOOLSET_TELEMETRY, {
          callId,
          payload,
        } satisfies ToolsetTelemetryPayload),
      {
        ms: telemetryTimeoutMs,
        message: `The Storybook at ${record.url} did not confirm a telemetry record.`,
      }
    );
  };

  return withToolsTelemetrySink<AttachedTools>(
    {
      mode: 'attached',
      host: 'remote',
      requestedMode,
      clientInfo,
      storybook: {
        attached: true,
        version: record.storybookVersion ?? versions.storybook,
        configDir,
        url: record.url,
        pid: record.pid,
        port: record.port,
        cwd: record.cwd,
        ...(args.siblings.length ? { siblings: args.siblings } : {}),
      },
      runtime: {
        configDir,
        toolsets: [],
        getService: () => {
          throw new ToolsRuntimeError({
            reason: 'command-unhandled',
            message: 'Toolset services are served by the attached Storybook.',
          });
        },
        close: async () => {},
      },

      async describe(options: ToolsDescribeOptions = {}): Promise<ToolsetCatalog> {
        assertOpen();
        const callId = generateToolsetCallId();
        return (await request(
          callId,
          () =>
            channel.emit(TOOLSET_DESCRIBE, {
              callId,
              clientInfo: rpcClient,
              ...(options.toolset !== undefined ? { toolset: options.toolset } : {}),
            } satisfies ToolsetDescribePayload),
          {
            ms: describeTimeoutMs,
            message: `The Storybook at ${record.url} did not list its tools in time. Retry, or restart that Storybook if this persists.`,
          }
        )) as ToolsetCatalog;
      },

      async call(
        ref: string,
        input: Record<string, unknown> = {},
        options: ToolsCallOptions = {}
      ): Promise<InvokedToolsetOutcome> {
        assertOpen();
        const start = Date.now();
        const telemetry = {
          ref,
          clientInfo,
          requestedMode,
          resolvedMode: 'attached',
          host: 'remote',
          configDir,
          sink: sendTelemetry,
        } as const;
        try {
          const outcome = await invoke(ref, input, options);
          await reportSdkInvocation({
            ...telemetry,
            result: outcome,
            report: outcome.telemetry,
            duration: Date.now() - start,
          });
          return outcome;
        } catch (error) {
          await reportSdkInvocation({
            ...telemetry,
            result: { error },
            duration: Date.now() - start,
          });
          throw error;
        }
      },

      async close(): Promise<void> {
        if (closed) {
          return;
        }
        closed = true;
        failAll(closedError());
        for (const [event, listener] of listeners) {
          channel.off(event, listener);
        }
        connection.close();
      },
    },
    sendTelemetry
  );
}

function closedError(): ToolsRuntimeError {
  return new ToolsRuntimeError({
    reason: 'closed',
    message: 'This tools host is closed. Create a new one with `createTools`.',
  });
}
