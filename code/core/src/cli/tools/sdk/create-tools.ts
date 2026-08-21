import { versions } from 'storybook/internal/common';

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
import { AttachUnavailableError, ToolsRuntimeError } from './errors.ts';
import { bootstrapToolsRuntime, type ToolsRuntime } from './local-runtime.ts';
import type {
  CreateToolsOptions,
  LocalTools,
  Tools,
  ToolsCallOptions,
  ToolsClientInfo,
  ToolsDescribeOptions,
  ToolsetCatalog,
} from './types.ts';

/** Injectable dependencies for tests. Not part of the public SDK. */
export type CreateToolsDeps = {
  bootstrap?: typeof bootstrapToolsRuntime;
};

/**
 * Resolve a host for the tools the target Storybook configuration registers.
 *
 * `local` loads that configuration in this process, which adopts the target directory as
 * `process.cwd()` for the rest of the process — everything the `services` preset hooks register
 * keys its file mapping off it. Capture your launch directory first if you still need it.
 *
 * @throws {ToolsRuntimeError} With reason `mode-unavailable` for `attached` and `auto`, which
 *   attach to a running Storybook and are not available yet; with reason `config-load-failed` when
 *   the target configuration cannot be loaded.
 */
export function createTools(
  options: CreateToolsOptions & { mode: 'local' },
  deps?: CreateToolsDeps
): Promise<LocalTools>;
export function createTools(options?: CreateToolsOptions, deps?: CreateToolsDeps): Promise<Tools>;
export async function createTools(
  options: CreateToolsOptions = {},
  deps: CreateToolsDeps = {}
): Promise<Tools> {
  const mode = options.mode ?? 'auto';
  if (mode !== 'local') {
    throw new ToolsRuntimeError({
      reason: 'mode-unavailable',
      message: `The \`${mode}\` tools mode attaches to a running Storybook, which is not available yet. Pass \`mode: 'local'\` to load the target Storybook configuration in this process.`,
    });
  }

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

  const clientInfo: Required<ToolsClientInfo> = {
    name: options.clientInfo?.name ?? 'storybook-tools-sdk',
    version: options.clientInfo?.version ?? versions.storybook,
    kind: options.clientInfo?.kind ?? 'sdk',
  };
  return createLocalTools(runtime, clientInfo);
}

function transportFor(kind: Required<ToolsClientInfo>['kind']): ToolsetTransport {
  return kind === 'cli' ? 'cli' : 'sdk';
}

function createLocalTools(
  runtime: ToolsRuntime,
  clientInfo: Required<ToolsClientInfo>
): LocalTools {
  const transport = transportFor(clientInfo.kind);
  let closed = false;

  const assertOpen = () => {
    if (closed) {
      throw new ToolsRuntimeError({
        reason: 'closed',
        message: 'This tools host is closed. Create a new one with `createTools`.',
      });
    }
  };

  const contextFor = (options: ToolsCallOptions = {}): ToolsetCtx => ({
    transport,
    getService: runtime.getService,
    ...(options.origin ? { origin: options.origin } : {}),
    ...(options.telemetry ? { telemetry: options.telemetry } : {}),
  });

  return {
    mode: 'local',
    clientInfo,
    storybook: { version: versions.storybook, configDir: runtime.configDir },

    async describe(options: ToolsDescribeOptions = {}): Promise<ToolsetCatalog> {
      assertOpen();
      const toolsets =
        options.toolset === undefined ? runtime.toolsets : [findToolset(runtime, options.toolset)];
      return {
        configDir: runtime.configDir,
        toolsets: toolsets.map((toolset) => toCatalogEntry(toolset, contextFor())),
      };
    },

    async call(
      ref: string,
      input: Record<string, unknown> = {},
      options: ToolsCallOptions = {}
    ): Promise<AnyToolsetOutcome> {
      assertOpen();
      options.signal?.throwIfAborted();

      const { toolsetId, methodName } = splitRef(ref);
      const method = findMethod(findToolset(runtime, toolsetId), methodName);

      if (method.requiresDevServer && !options.origin) {
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
        });
      }

      return raceAbort(options.signal, method.handler(validation.value, contextFor(options)));
    },

    async close(): Promise<void> {
      if (closed) {
        return;
      }
      closed = true;
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
