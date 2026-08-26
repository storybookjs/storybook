import { versions } from 'storybook/internal/common';

import { StorybookDevServerDisconnectedError } from '../../../server-errors.ts';
import { formatIssues } from '../../../shared/open-service/errors.ts';
import type {
  AnyToolsetDefinition,
  AnyToolsetMethod,
  AnyToolsetOutcome,
  ToolsetCtx,
  ToolsetTransport,
} from '../../../shared/open-service/toolset-definition.ts';
import { parseToolsetMethodId } from '../../../shared/open-service/toolset-names.ts';
import { toCatalogEntry } from './catalog.ts';
import type { AttachedBootstrapResult } from './attached-runtime.ts';
import { formatAttachFallback } from './attach-messages.ts';
import { spawnChildHost } from './child-client.ts';
import {
  reportSdkAttachGate,
  reportSdkInvocation,
  resolveCallTelemetry,
  toolsCommandDimensions,
} from './command-telemetry.ts';
import {
  AttachUnavailableError,
  ToolsRuntimeError,
  attachGateReasonFromError,
  isAttachGateError,
  type ToolsAttachGateReason,
} from './errors.ts';
import type { ToolsRuntime } from './local-runtime.ts';
import type {
  AttachedTools,
  CreateToolsOptions,
  LocalTools,
  Tools,
  ToolsCallOptions,
  ToolsClientInfo,
  ToolsDescribeOptions,
  ToolsHostKind,
  ToolsMode,
  ToolsStorybookInfo,
  ToolsetCatalog,
} from './types.ts';

/** Injectable dependencies for tests. Not part of the public SDK. */
export type CreateToolsDeps = {
  bootstrap?: (target: { cwd?: string; configDir?: string }) => Promise<ToolsRuntime>;
  attach?: (
    target: { cwd?: string; configDir?: string },
    deps?: unknown
  ) => Promise<
    | AttachedBootstrapResult
    | {
        runtime: ToolsRuntime;
        record: { url: string; pid: number; configDir?: string; cwd?: string };
        connection: { close(): void; disconnected: Promise<never> };
      }
  >;
  spawnChild?: typeof spawnChildHost;
};

/**
 * Resolve a host for the tools the target Storybook configuration registers.
 *
 * `local` loads that configuration in this process, which adopts the target directory as
 * `process.cwd()` for the rest of the process — everything the `services` preset hooks register
 * keys its file mapping off it. Capture your launch directory first if you still need it.
 *
 * `attached` joins a running Storybook over its channel and never changes `process.cwd()`. When
 * this process is not that instance's twin, attached mode defaults to spawning a child host from
 * the `storybook` package resolved under the instance directory.
 *
 * `auto` tries `attached` first and, on a gate failure, loads `local` instead. The returned host
 * then carries `fallbackNotice` with the gate message and that it fell back.
 *
 * @throws {ToolsRuntimeError} With reason `config-load-failed` when the target configuration cannot
 *   be loaded.
 * @throws {AttachUnavailableError} When `attached` cannot find or reach a matching instance.
 * @throws {EnvironmentMismatchError} When this process is not the instance's twin and auto-spawn is
 *   declined, or when spawning cannot reconcile the running instance with the project package.
 * @throws {SpawnFailedError} When a child host cannot be resolved or started.
 */
export function createTools(
  options: CreateToolsOptions & { mode: 'local' },
  deps?: CreateToolsDeps
): Promise<LocalTools>;
export function createTools(
  options: CreateToolsOptions & { mode: 'attached' },
  deps?: CreateToolsDeps
): Promise<AttachedTools>;
export function createTools(options?: CreateToolsOptions, deps?: CreateToolsDeps): Promise<Tools>;
export async function createTools(
  options: CreateToolsOptions = {},
  deps: CreateToolsDeps = {}
): Promise<Tools> {
  const mode: ToolsMode = options.mode ?? 'auto';
  const clientInfo: Required<ToolsClientInfo> = {
    name: options.clientInfo?.name ?? 'storybook-tools-sdk',
    version: options.clientInfo?.version ?? versions.storybook,
    kind: options.clientInfo?.kind ?? 'sdk',
  };

  switch (mode) {
    case 'attached':
      try {
        return await createAttachedTools(options, deps, clientInfo, mode);
      } catch (error) {
        if (isAttachGateError(error)) {
          await reportSdkAttachGate({
            error,
            clientInfo,
            requestedMode: mode,
            configDir: options.configDir,
          });
        }
        throw error;
      }
    case 'auto':
      try {
        return await createAttachedTools(options, deps, clientInfo, mode);
      } catch (error) {
        if (!isAttachGateError(error)) {
          throw error;
        }
        const notice = formatAttachFallback(error.message);
        const fallbackReason = attachGateReasonFromError(error);
        try {
          return await createLocalTools(options, deps, clientInfo, mode, {
            fallbackNotice: notice,
            fallbackReason,
          });
        } catch (localError) {
          if (
            localError instanceof ToolsRuntimeError &&
            localError.data.reason === 'config-load-failed'
          ) {
            throw new ToolsRuntimeError({
              reason: 'config-load-failed',
              message: `${notice}\n\n${localError.message}`,
              cause: localError.data.cause,
            });
          }
          throw localError;
        }
      }
    case 'local':
      return createLocalTools(options, deps, clientInfo, mode);
    default: {
      const exhaustive: never = mode;
      throw exhaustive;
    }
  }
}

async function createAttachedTools(
  options: CreateToolsOptions,
  deps: CreateToolsDeps,
  clientInfo: Required<ToolsClientInfo>,
  requestedMode: ToolsMode
): Promise<AttachedTools> {
  process.env.STORYBOOK_ATTACHED_TOOLS = 'true';
  // local-runtime pulls core-server at import, which must not run before the attached channel is prepared.
  const { bootstrapAttachedRuntime } = await import('./attached-runtime.ts');
  const isChildHost = process.env.STORYBOOK_TOOLS_CHILD_HOST === 'true';
  const autoSpawn = isChildHost ? false : (options.autoSpawn ?? true);
  const attached = await (
    deps.attach ?? ((target) => bootstrapAttachedRuntime({ ...target, autoSpawn }))
  )({
    cwd: options.cwd,
    configDir: options.configDir,
  });
  if ('kind' in attached && attached.kind === 'spawn') {
    return (deps.spawnChild ?? spawnChildHost)({
      record: attached.record,
      options: { ...options, mode: 'attached', autoSpawn: false, cwd: attached.record.cwd },
      clientInfo,
      requestedMode,
    });
  }
  const inProcess = attached as {
    runtime: ToolsRuntime;
    record: { url: string; pid: number; configDir?: string };
    connection: { close(): void; disconnected: Promise<never> };
  };
  return createToolsHost({
    mode: 'attached',
    host: 'in-process',
    requestedMode,
    runtime: inProcess.runtime,
    clientInfo,
    storybook: {
      version: versions.storybook,
      configDir: inProcess.runtime.configDir,
      url: inProcess.record.url,
      pid: inProcess.record.pid,
    },
    close: () => inProcess.connection.close(),
    disconnected: inProcess.connection.disconnected,
  });
}

async function createLocalTools(
  options: CreateToolsOptions,
  deps: CreateToolsDeps,
  clientInfo: Required<ToolsClientInfo>,
  requestedMode: ToolsMode,
  fallback?: { fallbackNotice: string; fallbackReason?: ToolsAttachGateReason }
): Promise<LocalTools> {
  delete process.env.STORYBOOK_ATTACHED_TOOLS;
  const { bootstrapToolsRuntime } = await import('./local-runtime.ts');
  let runtime: ToolsRuntime;
  try {
    runtime = await (deps.bootstrap ?? bootstrapToolsRuntime)({
      cwd: options.cwd,
      configDir: options.configDir,
    });
  } catch (error) {
    throw new ToolsRuntimeError({
      reason: 'config-load-failed',
      message: `Could not load the Storybook configuration for this project: ${
        error instanceof Error ? error.message : String(error)
      }`,
      cause: error,
    });
  }

  return createToolsHost({
    mode: 'local',
    host: 'in-process',
    requestedMode,
    ...fallback,
    runtime,
    clientInfo,
    storybook: { version: versions.storybook, configDir: runtime.configDir },
  });
}

function transportFor(kind: Required<ToolsClientInfo>['kind']): ToolsetTransport {
  return kind === 'cli' ? 'cli' : 'sdk';
}

function createToolsHost(args: {
  mode: 'local';
  host: ToolsHostKind;
  requestedMode: ToolsMode;
  fallbackNotice?: string;
  fallbackReason?: ToolsAttachGateReason;
  runtime: ToolsRuntime;
  clientInfo: Required<ToolsClientInfo>;
  storybook: ToolsStorybookInfo;
  close?: () => void;
  disconnected?: Promise<never>;
}): LocalTools;
function createToolsHost(args: {
  mode: 'attached';
  host: ToolsHostKind;
  requestedMode: ToolsMode;
  fallbackNotice?: string;
  fallbackReason?: ToolsAttachGateReason;
  runtime: ToolsRuntime;
  clientInfo: Required<ToolsClientInfo>;
  storybook: ToolsStorybookInfo;
  close?: () => void;
  disconnected?: Promise<never>;
}): AttachedTools;
function createToolsHost(args: {
  mode: 'local' | 'attached';
  host: ToolsHostKind;
  requestedMode: ToolsMode;
  fallbackNotice?: string;
  fallbackReason?: ToolsAttachGateReason;
  runtime: ToolsRuntime;
  clientInfo: Required<ToolsClientInfo>;
  storybook: ToolsStorybookInfo;
  close?: () => void;
  disconnected?: Promise<never>;
}): Tools {
  const { mode, host, requestedMode, runtime, clientInfo, storybook } = args;
  const baseCtx: ToolsetCtx = {
    transport: transportFor(clientInfo.kind),
    getService: runtime.getService,
    ...(storybook.url ? { origin: storybook.url } : {}),
  };
  let closed = false;

  const assertOpen = () => {
    if (closed) {
      throw new ToolsRuntimeError({
        reason: 'closed',
        message: 'This tools host is closed. Create a new one with `createTools`.',
      });
    }
  };

  const invoke = async (
    ref: string,
    input: Record<string, unknown>,
    options: ToolsCallOptions
  ): Promise<AnyToolsetOutcome> => {
    options.signal?.throwIfAborted();

    const { toolsetId, methodName } = splitRef(ref);
    const method = findMethod(findToolset(runtime, toolsetId), methodName);

    if (mode === 'local' && method.requiresDevServer) {
      throw new AttachUnavailableError({
        reason: 'no-instance',
        instances: [],
        remediation: `\`${ref}\` needs a running Storybook dev server, and this tools host loaded the project's configuration on its own. Start Storybook (for example \`npm run storybook\`), then retry.`,
      });
    }

    const validation = await method.input['~standard'].validate(input);
    if (validation.issues) {
      throw new ToolsRuntimeError({
        reason: 'invalid-input',
        message: `Invalid input for \`${ref}\`:\n${formatIssues(validation.issues)}`,
        issues: validation.issues,
      });
    }

    return raceAbort(
      options.signal,
      method.handler(validation.value, {
        ...baseCtx,
        ...(options.origin !== undefined ? { origin: options.origin } : {}),
        ...(options.telemetry ? { telemetry: options.telemetry } : {}),
      })
    );
  };

  const dimensions = toolsCommandDimensions({
    clientInfo,
    requestedMode,
    resolvedMode: mode,
    host,
    fallbackReason: args.fallbackReason,
  });

  return {
    mode,
    host,
    requestedMode,
    clientInfo,
    runtime,
    storybook,
    ...(args.fallbackNotice ? { fallbackNotice: args.fallbackNotice } : {}),
    ...(args.fallbackReason ? { fallbackReason: args.fallbackReason } : {}),

    async describe(options: ToolsDescribeOptions = {}): Promise<ToolsetCatalog> {
      assertOpen();
      const toolsets =
        options.toolset === undefined ? runtime.toolsets : [findToolset(runtime, options.toolset)];
      return {
        configDir: runtime.configDir,
        toolsets: toolsets.map((toolset) => toCatalogEntry(toolset, baseCtx)),
      };
    },

    async call(
      ref: string,
      input: Record<string, unknown> = {},
      options: ToolsCallOptions = {}
    ): Promise<AnyToolsetOutcome> {
      assertOpen();
      const telemetry = resolveCallTelemetry(options, dimensions, {
        clientInfo,
        configDir: runtime.configDir,
      });
      const callOptions: ToolsCallOptions = {
        ...options,
        ...(telemetry ? { telemetry } : {}),
      };
      const start = Date.now();
      try {
        const outcome = args.disconnected
          ? await Promise.race([invoke(ref, input, callOptions), args.disconnected])
          : await invoke(ref, input, callOptions);
        await reportSdkInvocation({
          ref,
          clientInfo,
          requestedMode,
          resolvedMode: mode,
          host,
          fallbackReason: args.fallbackReason,
          result: outcome,
          duration: Date.now() - start,
          configDir: runtime.configDir,
        });
        return outcome;
      } catch (error) {
        const mapped =
          error instanceof StorybookDevServerDisconnectedError
            ? new ToolsRuntimeError({
                reason: 'connection-lost',
                message: error.message,
                cause: error,
              })
            : error;
        await reportSdkInvocation({
          ref,
          clientInfo,
          requestedMode,
          resolvedMode: mode,
          host,
          fallbackReason: args.fallbackReason,
          result: { error: mapped },
          duration: Date.now() - start,
          configDir: runtime.configDir,
        });
        throw mapped;
      }
    },

    async close(): Promise<void> {
      if (closed) {
        return;
      }
      closed = true;
      args.close?.();
      await runtime.close();
    },
  };
}

function raceAbort<T>(signal: AbortSignal | undefined, work: T | PromiseLike<T>): Promise<T> {
  const pending = Promise.resolve(work);
  if (!signal) {
    return pending;
  }
  signal.throwIfAborted();

  let onAbort!: () => void;
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
  });

  return Promise.race([pending, aborted]).finally(() => {
    signal.removeEventListener('abort', onAbort);
  });
}

function splitRef(ref: string): { toolsetId: string; methodName: string } {
  try {
    return parseToolsetMethodId(ref);
  } catch {
    throw new ToolsRuntimeError({
      reason: 'unknown-method',
      message: `Invalid tool reference \`${ref}\`. Expected \`toolsetId.methodName\`.`,
    });
  }
}

function findToolset(runtime: ToolsRuntime, toolsetId: string): AnyToolsetDefinition {
  const toolset = runtime.toolsets.find((candidate) => candidate.id === toolsetId);
  if (!toolset) {
    throw new ToolsRuntimeError({
      reason: 'unknown-toolset',
      message: `Unknown toolset \`${toolsetId}\`. The Storybook configuration at ${
        runtime.configDir
      } provides: ${runtime.toolsets.map((candidate) => candidate.id).join(', ')}.`,
    });
  }
  return toolset;
}

function findMethod(toolset: AnyToolsetDefinition, methodName: string): AnyToolsetMethod {
  if (!Object.hasOwn(toolset.methods, methodName)) {
    throw new ToolsRuntimeError({
      reason: 'unknown-method',
      message: `Unknown tool \`${toolset.id}.${methodName}\`. The \`${
        toolset.id
      }\` toolset provides: ${Object.keys(toolset.methods).join(', ')}.`,
    });
  }
  return toolset.methods[methodName];
}
