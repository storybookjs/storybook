import { resolve } from 'pathe';

import { versions } from '@storybook/core/internal/common';

import { StorybookDevServerDisconnectedError } from '@storybook/core/internal/server-errors';
import {
  createNodeChannel as connectNodeChannel,
  type NodeChannelConnection,
} from './node-channel.ts';
import type { Storybook } from '@storybook/core';
import { detectAgent } from '@storybook/core/internal/telemetry';
import { readRegistry } from './instances/registry.ts';
import { selectInstances } from './instances/resolve.ts';
import { resolveStorybookConfigDir } from './config-dir.ts';
import type { StorybookInstanceRecord } from './instances/types.ts';
import {
  formatConnectionFailed,
  formatInstallationMismatch,
  formatNoInstance,
  formatOldServer,
  formatPortMismatch,
  formatUnknownInstallation,
} from './attach-messages.ts';
import { AttachUnavailableError, EnvironmentMismatchError, configLoadFailed } from './errors.ts';
import type { InstanceFactoryDeps, StorybookFactory } from './instance-factory.ts';
import { TOOLSET_RPC_PROTOCOL_VERSION } from '@storybook/core/internal/deep/shared/open-service/toolset-rpc';
import { checkInstallation, findCorePackageRoot } from './installation.ts';
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

/** The instance serves the toolset RPC: describe and call go over the connection. */
export type AttachedRemoteResult = {
  kind: 'remote';
  record: StorybookInstanceRecord;
  /** Instances that also matched the target project but were not selected, best first. */
  siblings: StorybookInstanceRecord[];
  connection: NodeChannelConnection;
};

export type AttachedBootstrapResult =
  | AttachedInProcessResult
  | AttachedSpawnResult
  | AttachedRemoteResult;

export type AttachRuntimeDeps = {
  readRegistry?: typeof readRegistry;
  createNodeChannel?: (options: {
    url: string;
    token: string;
  }) => NodeChannelConnection | Promise<NodeChannelConnection>;
  createStorybook?: StorybookFactory;
  instanceFactory?: InstanceFactoryDeps;
  version?: string;
  corePath?: () => string | undefined;
  hasChildHost?: (storybookPath: string) => boolean;
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

  // The RPC carries JSON only, so the installation gate and the instance factory do not apply.
  if (record.toolsetRpc === TOOLSET_RPC_PROTOCOL_VERSION) {
    const connection = await connectToInstance(record, record.token, deps);
    return { kind: 'remote', record, siblings, connection };
  }

  const callerCorePath = (deps.corePath ?? findCorePackageRoot)();
  const installation = checkInstallation(record, callerCorePath, {
    hasChildHost: deps.hasChildHost,
  });
  if (!installation.ok) {
    const autoSpawn = options.autoSpawn ?? false;
    const isChildHost = deps.isChildHost ?? process.env.STORYBOOK_TOOLS_CHILD_HOST === 'true';
    if (
      installation.reason === 'different-installation' &&
      installation.storybookPath &&
      autoSpawn &&
      !isChildHost
    ) {
      return { kind: 'spawn', record, storybookPath: installation.storybookPath, siblings };
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

  // Loaded on demand: the instance factory pulls in all of core, which the RPC path never needs.
  const { resolveInstanceFactory } = await import('./instance-factory.ts');
  const factory = resolveInstanceFactory(
    { explicit: deps.createStorybook, resolutionRoot: record.storybookPath ?? record.cwd },
    deps.instanceFactory
  );
  if (factory.kind === 'mismatch') {
    throw new EnvironmentMismatchError({ reason: formatUnknownInstallation() });
  }

  const connection = await connectToInstance(record, record.token, deps);

  const configDir = record.configDir ?? resolve(record.cwd, '.storybook');
  let storybook: Storybook;
  try {
    storybook = await factory.createStorybook({
      configDir,
      workingDir: record.cwd,
      mode: 'headless',
      attach: { transport: connection.transport },
    });
    await storybook.ready();
  } catch (error) {
    connection.close();
    throw configLoadFailed(error);
  }

  return {
    kind: 'in-process',
    runtime: {
      storybook,
      configDir: storybook.configDir,
      toolsets: storybook.toolsets.values(),
      getService: (id, options) => storybook.services.get(id as never, options),
      close: async () => {
        try {
          await storybook.close();
        } finally {
          connection.close();
        }
      },
    },
    record,
    siblings,
    connection,
  };
}

async function connectToInstance(
  record: StorybookInstanceRecord,
  token: string,
  deps: AttachRuntimeDeps
): Promise<NodeChannelConnection> {
  let connection: NodeChannelConnection | undefined;
  try {
    connection = await (deps.createNodeChannel ?? connectNodeChannel)({ url: record.url, token });
    await waitForHandshake(connection);
    return connection;
  } catch {
    connection?.close();
    throw new AttachUnavailableError({
      reason: 'connection-failed',
      instances: [record],
      remediation: formatConnectionFailed(record),
    });
  }
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
