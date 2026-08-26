import { versions } from 'storybook/internal/common';

import { StorybookDevServerDisconnectedError } from '../../../server-errors.ts';
import { formatIssues } from '../../../shared/open-service/errors.ts';
import type {
  AnyToolsetDefinition,
  AnyToolsetMethod,
  AnyToolsetOutcome,
  ToolsetCtx,
} from '../../../shared/open-service/toolset-definition.ts';
import { parseToolsetMethodId } from '../../../shared/open-service/toolset-names.ts';
import { toCatalogEntry } from './catalog.ts';
import type { AttachedBootstrapResult } from './attached-runtime.ts';
import { spawnChildHost } from './child-client.ts';
import { AttachUnavailableError, ToolsRuntimeError } from './errors.ts';
import type { ToolsRuntime } from './local-runtime.ts';
import type {
  AttachedTools,
  CreateToolsOptions,
  LocalTools,
  Tools,
  ToolsCallOptions,
  ToolsClientInfo,
  ToolsDescribeOptions,
  ToolsMode,
  ToolsStorybookInfo,
  ToolsetCatalog,
} from './types.ts';

/** Injectable dependencies for tests. */
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
 * @throws {ToolsRuntimeError} With reason `mode-unavailable` for `auto`, which is not available
 *   yet; with reason `config-load-failed` when the target configuration cannot be loaded.
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
  if (mode === 'auto') {
    throw new ToolsRuntimeError({
      reason: 'mode-unavailable',
      message: `The \`auto\` tools mode attaches to a running Storybook when it can and otherwise loads the project's configuration in this process, which is not available yet. Pass \`mode: 'local'\` or \`mode: 'attached'\`.`,
    });
  }

  const clientInfo: Required<ToolsClientInfo> = {
    name: options.clientInfo?.name ?? 'storybook-tools-sdk',
    version: options.clientInfo?.version ?? versions.storybook,
    kind: options.clientInfo?.kind ?? 'sdk',
  };

  if (mode === 'attached') {
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
      });
    }
    const inProcess = attached as {
      runtime: ToolsRuntime;
      record: { url: string; pid: number; configDir?: string };
      connection: { close(): void; disconnected: Promise<never> };
    };
    return createToolsHost({
      mode: 'attached',
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
    runtime,
    clientInfo,
    storybook: { version: versions.storybook, configDir: runtime.configDir },
  });
}

function createToolsHost(args: {
  mode: 'local';
  runtime: ToolsRuntime;
  clientInfo: Required<ToolsClientInfo>;
  storybook: ToolsStorybookInfo;
  close?: () => void;
  disconnected?: Promise<never>;
}): LocalTools;
function createToolsHost(args: {
  mode: 'attached';
  runtime: ToolsRuntime;
  clientInfo: Required<ToolsClientInfo>;
  storybook: ToolsStorybookInfo;
  close?: () => void;
  disconnected?: Promise<never>;
}): AttachedTools;
function createToolsHost(args: {
  mode: 'local' | 'attached';
  runtime: ToolsRuntime;
  clientInfo: Required<ToolsClientInfo>;
  storybook: ToolsStorybookInfo;
  close?: () => void;
  disconnected?: Promise<never>;
}): Tools {
  const { mode, runtime, clientInfo, storybook } = args;
  const baseCtx: ToolsetCtx = {
    transport: 'cli',
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
      Promise.resolve(
        method.handler(validation.value, {
          ...baseCtx,
          ...(options.origin ? { origin: options.origin } : {}),
          ...(options.telemetry ? { telemetry: options.telemetry } : {}),
        })
      )
    );
  };

  return {
    mode,
    clientInfo,
    runtime,
    storybook,

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
      try {
        if (!args.disconnected) {
          return await invoke(ref, input, options);
        }
        return await Promise.race([invoke(ref, input, options), args.disconnected]);
      } catch (error) {
        if (error instanceof StorybookDevServerDisconnectedError) {
          throw new ToolsRuntimeError({
            reason: 'connection-lost',
            message: error.message,
            cause: error,
          });
        }
        throw error;
      }
    },

    async close(): Promise<void> {
      if (closed) {
        return;
      }
      closed = true;
      args.close?.();
    },
  };
}

function raceAbort<T>(signal: AbortSignal | undefined, work: Promise<T>): Promise<T> {
  if (!signal) {
    return work;
  }
  signal.throwIfAborted();

  let onAbort!: () => void;
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
  });

  return Promise.race([work, aborted]).finally(() => {
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
  const method = toolset.methods[methodName];
  if (!method) {
    throw new ToolsRuntimeError({
      reason: 'unknown-method',
      message: `Unknown tool \`${toolset.id}.${methodName}\`. The \`${
        toolset.id
      }\` toolset provides: ${Object.keys(toolset.methods).join(', ')}.`,
    });
  }
  return method;
}
