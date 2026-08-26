import { createRequire } from 'node:module';
import { resolve } from 'node:path';

import { versions } from 'storybook/internal/common';

import { StorybookDevServerDisconnectedError } from '../../../server-errors.ts';
import {
  createNodeChannel as connectNodeChannel,
  type NodeChannelConnection,
} from './node-channel.ts';
import { setDelegatedMode } from '../../../shared/open-service/service-registry.ts';
import type { ToolsetGetService } from '../../../shared/open-service/toolset-definition.ts';
import { getRegisteredToolsets } from '../../../shared/open-service/toolset-registry.ts';
import { readRegistry } from '../instances/registry.ts';
import { listProjectMatches } from '../instances/resolve.ts';
import { resolveStorybookConfigDir } from '../config-dir.ts';
import type { StorybookInstanceRecord } from '../instances/types.ts';
import {
  formatConnectionFailed,
  formatCwdMismatch,
  formatMultipleMatches,
  formatNoInstance,
  formatOldServer,
  formatVersionMismatch,
} from './attach-messages.ts';
import { AttachUnavailableError, EnvironmentMismatchError, ToolsRuntimeError } from './errors.ts';
import { checkFidelity } from './fidelity.ts';
import type { ToolsRuntime } from './local-runtime.ts';

export type AttachedBootstrapResult = {
  runtime: ToolsRuntime;
  record: StorybookInstanceRecord;
  connection: Pick<NodeChannelConnection, 'close' | 'disconnected'>;
};

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
  cwd?: () => string;
  version?: string;
  resolveBinPath?: () => string;
};

export async function bootstrapAttachedRuntime(
  options: { cwd?: string; configDir?: string } = {},
  deps: AttachRuntimeDeps = {}
): Promise<AttachedBootstrapResult> {
  const discoveryCwd = resolve(options.cwd ?? process.cwd());
  const resolvedConfigDir = resolveStorybookConfigDir({
    cwd: discoveryCwd,
    configDir: options.configDir,
  });
  const records = await (deps.readRegistry ?? readRegistry)();
  const matches = listProjectMatches(records, {
    cwd: discoveryCwd,
    configDir: resolvedConfigDir,
    configDirExplicit: options.configDir != null,
  });

  if (matches.length === 0) {
    throw new AttachUnavailableError({
      reason: 'no-instance',
      instances: records,
      remediation: formatNoInstance(records),
    });
  }

  if (matches.length > 1) {
    throw new AttachUnavailableError({
      reason: 'multiple-matches',
      instances: matches,
      remediation: formatMultipleMatches(matches),
    });
  }

  const record = matches[0];
  const callerVersion = deps.version ?? versions.storybook;

  if (!record.token) {
    throw new AttachUnavailableError({
      reason: 'old-server',
      instances: [record],
      remediation: formatOldServer(callerVersion),
    });
  }

  const processCwd = deps.cwd?.() ?? process.cwd();
  const fidelity = checkFidelity(record, { cwd: processCwd, version: callerVersion });
  if (!fidelity.ok) {
    throw new EnvironmentMismatchError({
      instanceCwd: record.cwd,
      resolvedBinPath: (deps.resolveBinPath ?? resolveStorybookBinPath)(),
      reason:
        fidelity.kind === 'cwd'
          ? formatCwdMismatch(fidelity.processCwd, fidelity.instanceCwd)
          : formatVersionMismatch(fidelity.callerVersion, fidelity.instanceVersion),
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
    runtime: {
      configDir,
      toolsets: (deps.getRegisteredToolsets ?? getRegisteredToolsets)(),
      getService,
    },
    record,
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

function resolveStorybookBinPath(): string {
  try {
    return createRequire(import.meta.url).resolve('storybook/package.json');
  } catch {
    return process.execPath;
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
