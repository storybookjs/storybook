import { resolve } from 'node:path';

import { findStorybookPackageRoot, versions } from 'storybook/internal/common';

import { StorybookDevServerDisconnectedError } from '../../../server-errors.ts';
import {
  createNodeChannel as connectNodeChannel,
  type NodeChannelConnection,
} from './node-channel.ts';
import { setDelegatedMode } from '../../../shared/open-service/service-registry.ts';
import type { ToolsetGetService } from '../../../shared/open-service/toolset-definition.ts';
import { getRegisteredToolsets } from '../../../shared/open-service/toolset-registry.ts';
import { detectAgent } from '../../../telemetry/detect-agent.ts';
import { readRegistry } from '../instances/registry.ts';
import { selectInstances } from '../instances/resolve.ts';
import { resolveStorybookConfigDir } from '../config-dir.ts';
import type { StorybookInstanceRecord } from '../instances/types.ts';
import {
  formatConnectionFailed,
  formatInstallationMismatch,
  formatNoInstance,
  formatOldServer,
  formatPortMismatch,
  formatUnknownInstallation,
} from './attach-messages.ts';
import { AttachUnavailableError, EnvironmentMismatchError, ToolsRuntimeError } from './errors.ts';
import { checkInstallation } from './installation.ts';
import type { ToolsRuntime } from './local-runtime.ts';

export type AttachedInProcessResult = {
  kind: 'in-process';
  runtime: ToolsRuntime;
  record: StorybookInstanceRecord;
  /** Instances that also matched the target project but were not selected, best first. */
  siblings: StorybookInstanceRecord[];
  connection: Pick<NodeChannelConnection, 'close' | 'disconnected'>;
};

export type AttachedSpawnResult = {
  kind: 'spawn';
  record: StorybookInstanceRecord;
  /** The instance's verified installation root the child host must be resolved from. */
  storybookPath: string;
  /** Instances that also matched the target project but were not selected, best first. */
  siblings: StorybookInstanceRecord[];
};

export type AttachedBootstrapResult = AttachedInProcessResult | AttachedSpawnResult;

export type AttachRuntimeDeps = {
  readRegistry?: typeof readRegistry;
  createNodeChannel?: (options: {
    url: string;
    token: string;
  }) => NodeChannelConnection | Promise<NodeChannelConnection>;
  loadStorybook?: (options: { configDir: string; channel: unknown }) => Promise<unknown>;
  getService?: ToolsetGetService;
  setDelegatedMode?: typeof setDelegatedMode;
  getRegisteredToolsets?: typeof getRegisteredToolsets;
  version?: string;
  storybookPath?: () => string | undefined;
  isChildHost?: boolean;
  detectAgentName?: () => string | undefined;
};

export async function bootstrapAttachedRuntime(
  options: { cwd?: string; configDir?: string; port?: number; autoSpawn?: boolean } = {},
  deps: AttachRuntimeDeps = {}
): Promise<AttachedBootstrapResult> {
  const discoveryCwd = resolve(options.cwd ?? process.cwd());
  const resolvedConfigDir = resolveStorybookConfigDir({
    cwd: discoveryCwd,
    configDir: options.configDir,
  });
  const records = await (deps.readRegistry ?? readRegistry)();
  const selection = selectInstances(records, {
    cwd: discoveryCwd,
    configDir: resolvedConfigDir,
    configDirExplicit: options.configDir != null,
    port: options.port,
    agent: (deps.detectAgentName ?? (() => detectAgent()?.name))(),
  });

  if (selection.kind === 'no-instance') {
    throw new AttachUnavailableError({
      reason: 'no-instance',
      instances: records,
      remediation: formatNoInstance(records),
    });
  }

  if (selection.kind === 'port-mismatch') {
    throw new AttachUnavailableError({
      reason: 'port-mismatch',
      instances: selection.candidates,
      remediation: formatPortMismatch(selection.port, selection.candidates),
    });
  }

  const [record, ...siblings] = selection.matches;
  const callerVersion = deps.version ?? versions.storybook;

  if (!record.token) {
    throw new AttachUnavailableError({
      reason: 'old-server',
      instances: [record],
      remediation: formatOldServer(callerVersion),
    });
  }

  const callerStorybookPath = (deps.storybookPath ?? findStorybookPackageRoot)();
  const installation = checkInstallation(record, callerStorybookPath);
  if (!installation.ok) {
    const autoSpawn = options.autoSpawn ?? false;
    const isChildHost = deps.isChildHost ?? process.env.STORYBOOK_TOOLS_CHILD_HOST === 'true';
    if (installation.reason === 'different-installation' && autoSpawn && !isChildHost) {
      return { kind: 'spawn', record, storybookPath: installation.instancePath, siblings };
    }
    throw new EnvironmentMismatchError({
      reason:
        installation.reason === 'different-installation'
          ? formatInstallationMismatch({
              callerPath: installation.callerPath,
              callerVersion,
              instancePath: installation.instancePath,
              instanceVersion: record.storybookVersion,
              configDir: record.configDir,
            })
          : formatUnknownInstallation(),
    });
  }

  let connection: NodeChannelConnection | undefined;
  try {
    connection = await (deps.createNodeChannel ?? connectNodeChannel)({
      url: record.url,
      token: record.token,
    });
    await waitForHandshake(connection);
  } catch {
    connection?.close();
    throw new AttachUnavailableError({
      reason: 'connection-failed',
      instances: [record],
      remediation: formatConnectionFailed(record),
    });
  }

  const enableDelegatedMode = deps.setDelegatedMode ?? setDelegatedMode;
  enableDelegatedMode(true);

  const configDir = record.configDir ?? resolve(record.cwd, '.storybook');
  const { loadStorybook, getService } = await resolveLoaders(deps);
  try {
    await loadStorybook({ configDir, channel: connection.channel });
  } catch (error) {
    enableDelegatedMode(false);
    connection.close();
    throw new ToolsRuntimeError({
      reason: 'config-load-failed',
      message: `Could not load the Storybook configuration for this project: ${
        error instanceof Error ? error.message : String(error)
      }`,
      cause: error,
    });
  }

  return {
    kind: 'in-process',
    runtime: {
      configDir,
      toolsets: (deps.getRegisteredToolsets ?? getRegisteredToolsets)(),
      getService,
      close: async () => {},
    },
    record,
    siblings,
    connection,
  };
}

async function resolveLoaders(deps: AttachRuntimeDeps): Promise<{
  loadStorybook: (options: { configDir: string; channel: unknown }) => Promise<unknown>;
  getService: ToolsetGetService;
}> {
  if (deps.loadStorybook && deps.getService) {
    return { loadStorybook: deps.loadStorybook, getService: deps.getService };
  }
  // Status stores are constructed when this module evaluates; the channel must already be prepared.
  const core = await import('storybook/internal/core-server');
  return {
    loadStorybook:
      deps.loadStorybook ??
      ((options) =>
        core.experimental_loadStorybook({
          configDir: options.configDir,
          channel: options.channel as never,
        })),
    getService: deps.getService ?? ((id, options) => core.getService(id as never, options)),
  };
}

const ATTACH_HANDSHAKE_TIMEOUT_MS = 10_000;

async function waitForHandshake(connection: NodeChannelConnection): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      connection.connected,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new StorybookDevServerDisconnectedError({
                reason: 'Timed out waiting for the Storybook channel to open',
              })
            ),
          ATTACH_HANDSHAKE_TIMEOUT_MS
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
