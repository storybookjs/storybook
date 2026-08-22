import { createRequire } from 'node:module';
import { resolve } from 'node:path';

import { versions } from 'storybook/internal/common';

import {
  createNodeChannel as connectNodeChannel,
  type NodeChannelConnection,
} from '../../../channels/node/index.ts';
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
  formatPortMismatch,
  formatRestartRequired,
  formatVersionMismatch,
} from './attach-messages.ts';
import {
  AttachUnavailableError,
  EnvironmentMismatchError,
  SpawnFailedError,
  ToolsRuntimeError,
} from './errors.ts';
import { resolveProjectStorybookVersion } from './resolve-project-storybook.ts';
import { planAttachHost } from './spawn-plan.ts';
import type { ToolsRuntime } from './local-runtime.ts';

export type AttachedInProcessResult = {
  kind: 'in-process';
  runtime: ToolsRuntime;
  record: StorybookInstanceRecord;
  connection: Pick<NodeChannelConnection, 'close' | 'disconnected'>;
};

export type AttachedSpawnResult = {
  kind: 'spawn';
  record: StorybookInstanceRecord;
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
  cwd?: () => string;
  version?: string;
  resolveBinPath?: () => string;
  isChildHost?: boolean;
  resolveProjectVersion?: (cwd: string) => string | undefined;
};

export async function bootstrapAttachedRuntime(
  options: { cwd?: string; configDir?: string; autoSpawn?: boolean; port?: number } = {},
  deps: AttachRuntimeDeps = {}
): Promise<AttachedBootstrapResult> {
  const discoveryCwd = resolve(options.cwd ?? process.cwd());
  const resolvedConfigDir = resolveStorybookConfigDir({
    cwd: discoveryCwd,
    configDir: options.configDir,
  });
  const records = await (deps.readRegistry ?? readRegistry)();
  const projectMatches = listProjectMatches(records, {
    cwd: discoveryCwd,
    configDir: resolvedConfigDir,
    configDirExplicit: options.configDir != null,
  });
  const matches =
    options.port == null
      ? projectMatches
      : projectMatches.filter((record) => record.port === options.port);

  if (matches.length === 0) {
    if (options.port != null && projectMatches.length > 0) {
      throw new AttachUnavailableError({
        reason: 'port-mismatch',
        instances: projectMatches,
        remediation: formatPortMismatch(options.port, projectMatches),
      });
    }
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
  const autoSpawn = options.autoSpawn ?? false;
  const isChildHost = deps.isChildHost ?? process.env.STORYBOOK_TOOLS_CHILD_HOST === 'true';
  const resolvedProjectVersion = (deps.resolveProjectVersion ?? resolveProjectStorybookVersion)(
    record.cwd
  );
  const plan = planAttachHost({
    processCwd,
    callerVersion,
    record,
    autoSpawn,
    isChildHost,
    resolvedProjectVersion,
  });
  const resolvedBinPath = (deps.resolveBinPath ?? resolveStorybookBinPath)();

  switch (plan.action) {
    case 'in-process':
      break;
    case 'spawn':
      return { kind: 'spawn', record };
    case 'throw-mismatch': {
      const { fidelity } = plan;
      throw new EnvironmentMismatchError({
        instanceCwd: record.cwd,
        resolvedBinPath,
        reason:
          fidelity.kind === 'cwd'
            ? formatCwdMismatch(fidelity.processCwd, fidelity.instanceCwd)
            : formatVersionMismatch(fidelity.callerVersion, fidelity.instanceVersion),
      });
    }
    case 'throw-restart':
      throw new EnvironmentMismatchError({
        instanceCwd: record.cwd,
        resolvedBinPath,
        reason: formatRestartRequired(plan.resolvedProjectVersion, plan.instanceVersion),
      });
    case 'throw-spawn-failed':
      throw new SpawnFailedError({
        reason: `Could not resolve the \`storybook\` package from ${record.cwd}. Install Storybook in that project, then retry.`,
      });
    default: {
      const exhaustive: never = plan;
      throw exhaustive;
    }
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
  // Loading presets can occupy this event loop longer than the 20s receive watchdog.
  connection.pauseHeartbeat();
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
  connection.resumeHeartbeat();

  return {
    kind: 'in-process',
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
        timer = setTimeout(() => reject(), ATTACH_HANDSHAKE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
