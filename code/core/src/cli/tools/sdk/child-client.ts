import { fork, type ChildProcess, type ForkOptions } from 'node:child_process';

import { logger } from 'storybook/internal/node-logger';

import {
  deserializeError,
  type SerializedError,
} from '../../../shared/open-service/service-error-serialization.ts';
import type {
  AnyToolsetOutcome,
  ToolsetTelemetry,
} from '../../../shared/open-service/toolset-definition.ts';
import {
  CHILD_HOST_PROTOCOL_VERSION,
  isChildMessage,
  type ChildHelloMessage,
  type ParentMessage,
} from './child-protocol.ts';
import {
  reportSdkInvocation,
  resolveCallTelemetry,
  toolsCommandDimensions,
} from './command-telemetry.ts';
import {
  AttachUnavailableError,
  EnvironmentMismatchError,
  SpawnFailedError,
  ToolsRuntimeError,
} from './errors.ts';
import { resolveChildHostScript } from './resolve-project-storybook.ts';
import type {
  AttachedTools,
  CreateToolsOptions,
  LocalTools,
  Tools,
  ToolsCallOptions,
  ToolsClientInfo,
  ToolsDescribeOptions,
  ToolsMode,
  ToolsetCatalog,
} from './types.ts';
import type { ToolsRuntime } from './local-runtime.ts';

export type SpawnChildHostDeps = {
  fork?: typeof fork;
  resolveScript?: (cwd: string) => string;
  logger?: Pick<typeof logger, 'log' | 'warn'>;
};

export async function spawnChildHost(
  args: {
    cwd: string;
    installationPath?: string;
    options: CreateToolsOptions & { mode: 'local' };
    clientInfo: Required<ToolsClientInfo>;
    requestedMode: ToolsMode;
  },
  deps?: SpawnChildHostDeps
): Promise<LocalTools>;
export async function spawnChildHost(
  args: {
    cwd: string;
    installationPath?: string;
    options: CreateToolsOptions & { mode: 'attached' };
    clientInfo: Required<ToolsClientInfo>;
    requestedMode: ToolsMode;
  },
  deps?: SpawnChildHostDeps
): Promise<AttachedTools>;
export async function spawnChildHost(
  args: {
    cwd: string;
    installationPath?: string;
    options: CreateToolsOptions;
    clientInfo: Required<ToolsClientInfo>;
    requestedMode: ToolsMode;
  },
  deps?: SpawnChildHostDeps
): Promise<Tools>;
export async function spawnChildHost(
  args: {
    cwd: string;
    installationPath?: string;
    options: CreateToolsOptions;
    clientInfo: Required<ToolsClientInfo>;
    requestedMode: ToolsMode;
  },
  deps: SpawnChildHostDeps = {}
): Promise<Tools> {
  const log = deps.logger ?? logger;
  const forkChild = deps.fork ?? fork;
  const cwd = args.cwd;
  const resolvedMode: 'local' | 'attached' = args.options.mode === 'local' ? 'local' : 'attached';

  const resolutionRoot = args.installationPath ?? cwd;
  let scriptPath: string;
  try {
    scriptPath = (deps.resolveScript ?? resolveChildHostScript)(resolutionRoot);
  } catch (cause) {
    throw new SpawnFailedError({
      reason: args.installationPath
        ? `The running Storybook's installation at ${resolutionRoot} can no longer resolve \`storybook/internal/tools/child-host\`. From your project directory, restart Storybook (for example \`npx storybook dev\`) and re-run this command from there.`
        : `Could not resolve \`storybook/internal/tools/child-host\` from ${resolutionRoot}. Install Storybook in that project, then retry.`,
      cause,
    });
  }

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    STORYBOOK_TOOLS_CHILD_HOST: 'true',
  };
  if (resolvedMode === 'attached') {
    env.STORYBOOK_ATTACHED_TOOLS = 'true';
  } else {
    delete env.STORYBOOK_ATTACHED_TOOLS;
  }

  let child: ChildProcess;
  try {
    child = forkChild(scriptPath, [], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      env,
    } satisfies ForkOptions);
  } catch (cause) {
    throw new SpawnFailedError({
      reason: `Could not start a tools child host for ${cwd}.`,
      cause,
    });
  }

  child.stdout?.on('data', (chunk: Buffer | string) => {
    log.log(String(chunk));
  });
  child.stderr?.on('data', (chunk: Buffer | string) => {
    log.warn(String(chunk));
  });

  const pending = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (error: unknown) => void }
  >();
  const pendingTelemetry = new Map<string, ToolsetTelemetry>();
  let closed = false;
  let nextId = 0;

  const failPending = (error: unknown) => {
    for (const [, waiter] of pending) {
      waiter.reject(error);
    }
    pending.clear();
  };

  const disconnected = new Promise<never>((_, reject) => {
    child.once('exit', (code, signal) => {
      if (closed) {
        return;
      }
      const error = new ToolsRuntimeError({
        reason: 'connection-lost',
        message: `The tools child host for ${cwd} exited${
          signal ? ` (${signal})` : code != null ? ` (code ${code})` : ''
        }.`,
      });
      failPending(error);
      reject(error);
    });
    child.once('error', (cause) => {
      if (closed) {
        return;
      }
      const error = new SpawnFailedError({
        reason: `The tools child host for ${cwd} failed.`,
        cause,
      });
      failPending(error);
      reject(error);
    });
  });
  void disconnected.catch(() => {});

  child.on('message', (raw: unknown) => {
    if (!isChildMessage(raw) || raw.type === 'hello') {
      return;
    }
    if (raw.type === 'telemetry') {
      void Promise.resolve()
        .then(() => pendingTelemetry.get(raw.id)?.(raw.event, raw.payload))
        .catch(() => {
          // Method telemetry is never part of the call result.
        });
      return;
    }
    const waiter = pending.get(raw.id);
    if (!waiter) {
      return;
    }
    pending.delete(raw.id);
    if (raw.type === 'result') {
      waiter.resolve(raw.value);
      return;
    }
    waiter.reject(rehydrateSerializedToolsError(raw.error as SerializedError));
  });

  const send = (message: ParentMessage) => {
    if (!child.send) {
      throw new SpawnFailedError({
        reason: `The tools child host for ${cwd} has no IPC channel.`,
      });
    }
    child.send(message);
  };

  const request = (message: Exclude<ParentMessage, { type: 'init' | 'close' | 'cancel' }>) => {
    if (closed) {
      return Promise.reject(
        new ToolsRuntimeError({
          reason: 'closed',
          message: 'This tools host is closed. Create a new one with `createTools`.',
        })
      );
    }
    return Promise.race([
      new Promise<unknown>((resolve, reject) => {
        pending.set(message.id, { resolve, reject });
        send(message);
      }),
      disconnected,
    ]);
  };

  let hello: ChildHelloMessage;
  try {
    hello = await waitForHello(child, send, {
      cwd: cwd,
      options: args.options,
      clientInfo: args.clientInfo,
      resolvedMode,
    });
  } catch (error) {
    closed = true;
    child.kill();
    throw error;
  }

  if (hello.version !== CHILD_HOST_PROTOCOL_VERSION) {
    closed = true;
    child.kill();
    throw new SpawnFailedError({
      reason: `The tools child host at ${cwd} speaks protocol ${hello.version}, but this process expects ${CHILD_HOST_PROTOCOL_VERSION}. Restart your Storybook so both sides match.`,
    });
  }

  const runtime: ToolsRuntime = {
    configDir: hello.storybook.configDir,
    toolsets: [],
    getService: () => {
      throw new ToolsRuntimeError({
        reason: 'command-unhandled',
        message: 'Toolset services are served by the project-local child host.',
      });
    },
    close: async () => {},
  };

  const assertOpen = () => {
    if (closed) {
      throw new ToolsRuntimeError({
        reason: 'closed',
        message: 'This tools host is closed. Create a new one with `createTools`.',
      });
    }
  };

  const dimensions = toolsCommandDimensions({
    clientInfo: args.clientInfo,
    requestedMode: args.requestedMode,
    resolvedMode,
    host: 'child',
  });

  return {
    mode: resolvedMode,
    host: 'child',
    requestedMode: args.requestedMode,
    clientInfo: hello.clientInfo,
    storybook: hello.storybook,
    runtime,
    async describe(options: ToolsDescribeOptions = {}): Promise<ToolsetCatalog> {
      assertOpen();
      return (await request({ type: 'describe', id: String(++nextId), options })) as ToolsetCatalog;
    },
    async call(
      ref: string,
      input: Record<string, unknown> = {},
      options: ToolsCallOptions = {}
    ): Promise<AnyToolsetOutcome> {
      assertOpen();
      options.signal?.throwIfAborted();
      const id = String(++nextId);
      const telemetry = resolveCallTelemetry(options, dimensions, {
        clientInfo: args.clientInfo,
        configDir: hello.storybook.configDir,
      });
      if (telemetry) {
        pendingTelemetry.set(id, telemetry);
      }
      let onAbort: (() => void) | undefined;
      const aborted = options.signal
        ? new Promise<never>((_, reject) => {
            onAbort = () => {
              try {
                send({ type: 'cancel', id });
              } catch {
                // The child may already have disconnected.
              }
              reject(options.signal!.reason);
            };
            options.signal!.addEventListener('abort', onAbort, { once: true });
          })
        : undefined;
      const start = Date.now();
      try {
        const work = request({ type: 'call', id, ref, input });
        const outcome = (await (aborted
          ? Promise.race([work, aborted])
          : work)) as AnyToolsetOutcome;
        await reportSdkInvocation({
          ref,
          clientInfo: args.clientInfo,
          requestedMode: args.requestedMode,
          resolvedMode,
          host: 'child',
          result: outcome,
          duration: Date.now() - start,
          configDir: hello.storybook.configDir,
        });
        return outcome;
      } catch (error) {
        await reportSdkInvocation({
          ref,
          clientInfo: args.clientInfo,
          requestedMode: args.requestedMode,
          resolvedMode,
          host: 'child',
          result: { error },
          duration: Date.now() - start,
          configDir: hello.storybook.configDir,
        });
        throw error;
      } finally {
        pendingTelemetry.delete(id);
        if (onAbort) {
          options.signal?.removeEventListener('abort', onAbort);
        }
      }
    },
    async close(): Promise<void> {
      if (closed) {
        return;
      }
      closed = true;
      failPending(
        new ToolsRuntimeError({
          reason: 'closed',
          message: 'This tools host is closed. Create a new one with `createTools`.',
        })
      );
      try {
        send({ type: 'close' });
      } catch {
        // The child may already have disconnected.
      }
      child.kill();
    },
  };
}

const HELLO_TIMEOUT_MS = 10_000;

async function waitForHello(
  child: ChildProcess,
  send: (message: ParentMessage) => void,
  args: {
    cwd: string;
    options: CreateToolsOptions;
    clientInfo: Required<ToolsClientInfo>;
    resolvedMode: 'local' | 'attached';
  }
): Promise<ChildHelloMessage> {
  const { cwd, options, clientInfo, resolvedMode } = args;
  return new Promise<ChildHelloMessage>((resolve, reject) => {
    const onMessage = (raw: unknown) => {
      if (isChildMessage(raw) && raw.type === 'hello') {
        cleanup();
        resolve(raw);
        return;
      }
      if (isChildMessage(raw) && raw.type === 'error' && raw.id === 'init') {
        cleanup();
        reject(rehydrateSerializedToolsError(raw.error));
      }
    };
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      cleanup();
      reject(
        new SpawnFailedError({
          reason: `The tools child host for ${cwd} exited before it was ready${
            signal ? ` (${signal})` : code != null ? ` (code ${code})` : ''
          }.`,
        })
      );
    };
    const onError = (cause: Error) => {
      cleanup();
      reject(
        new SpawnFailedError({
          reason: `The tools child host for ${cwd} failed to start.`,
          cause,
        })
      );
    };
    const cleanup = () => {
      clearTimeout(timer);
      child.off('message', onMessage);
      child.off('exit', onExit);
      child.off('error', onError);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(
        new SpawnFailedError({
          reason: `The tools child host for ${cwd} did not become ready in time.`,
        })
      );
    }, HELLO_TIMEOUT_MS);
    child.on('message', onMessage);
    child.once('exit', onExit);
    child.once('error', onError);
    try {
      send({
        type: 'init',
        options: {
          ...options,
          cwd,
          mode: resolvedMode,
          autoSpawn: false,
          clientInfo,
        },
      });
    } catch (cause) {
      cleanup();
      reject(
        new SpawnFailedError({
          reason: `Could not initialize a tools child host for ${cwd}.`,
          cause,
        })
      );
    }
  });
}

function rehydrateSerializedToolsError(serialized: SerializedError): Error {
  const plain = deserializeError(serialized);
  const data = (plain as { data?: unknown }).data;
  if (data === undefined || data === null || typeof data !== 'object') {
    return plain;
  }
  switch (toolsErrorKind(serialized)) {
    case 'AttachUnavailableError':
      return new AttachUnavailableError(data as AttachUnavailableError['data']);
    case 'EnvironmentMismatchError':
      return new EnvironmentMismatchError(data as EnvironmentMismatchError['data']);
    case 'SpawnFailedError':
      return new SpawnFailedError(data as SpawnFailedError['data']);
    case 'ToolsRuntimeError':
      return new ToolsRuntimeError(data as ToolsRuntimeError['data']);
    default:
      return plain;
  }
}

function toolsErrorKind(serialized: SerializedError): string {
  const fromProps = serialized.properties?._name;
  if (typeof fromProps === 'string') {
    return fromProps;
  }
  const match = serialized.name.match(/\(([^)]+)\)$/);
  return match?.[1] ?? serialized.name;
}
