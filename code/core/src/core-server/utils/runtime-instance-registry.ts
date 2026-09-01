import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, rmSync } from 'node:fs';
import { chmod, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { homedir, userInfo } from 'node:os';

import { findStorybookPackageRoot, normalizeAddonName } from 'storybook/internal/common';
import type { StorybookConfig } from 'storybook/internal/types';

import { join, resolve } from 'pathe';

import { CLAUDE_PREVIEW_AGENT_NAME } from '../../shared/constants/agent-provenance.ts';
import { isClaudePreviewLaunch } from '../../shared/utils/agent-environment.ts';
import { detectAgent } from '../../telemetry/detect-agent.ts';

const STORYBOOK_MCP_ADDON = '@storybook/addon-mcp';
const DEFAULT_MCP_ENDPOINT = '/mcp';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;
const REGISTRY_DIR_MODE = 0o700;
const RECORD_FILE_MODE = 0o600;

// Node's promisify(execFile) closes over the original execFile via promisify.custom, so spies never see icacls.
function execFileAsync(file: string, args: readonly string[]) {
  return new Promise<void>((resolveExec, rejectExec) => {
    execFile(file, [...args], (error) => {
      if (error) {
        rejectExec(error);
        return;
      }
      resolveExec();
    });
  });
}

async function restrictOwnerAccess(targetPath: string, mode: number) {
  await chmod(targetPath, mode);
  if (process.platform !== 'win32') {
    return;
  }

  // chmod on Windows only toggles the writable bit; it does not create an owner-only ACL.
  const { username } = userInfo();
  try {
    await execFileAsync('icacls', [targetPath, '/inheritance:r', '/grant:r', `${username}:(F)`]);
  } catch (error) {
    throw new Error(
      `Could not restrict ${targetPath} to the current Windows user. The instance record would be readable by other accounts.`,
      { cause: error }
    );
  }
}

export type RuntimeInstanceRecord = {
  schemaVersion: 1;
  instanceId: string;
  pid: number;
  cwd: string;
  /**
   * Resolved config directory of the running Storybook. Lets `storybook ai` find this instance
   * from a different cwd in a monorepo (storybookjs/storybook#35359). Optional because records
   * written by older Storybooks lack it.
   */
  configDir?: string;
  url: string;
  port: number;
  /** Token authenticating clients against this instance's WebSocket channel. */
  token?: string;
  agent?: string;
  storybookVersion: string;
  /**
   * Realpathed root of the `storybook` package this dev server actually runs, derived from the
   * server's own module location. `storybook tools` attaches in-process when its own root is the
   * same installation, and spawns its child host from this root otherwise. Omitted when the root
   * cannot be derived, which makes attach refuse.
   */
  storybookPath?: string;
  startedAt: string;
  updatedAt: string;
  mcp: { status: 'not-installed' } | { status: 'ready'; endpoint: string };
};

export type RuntimeInstanceRegistration = {
  record: RuntimeInstanceRecord;
  recordPath: string;
  cleanup: () => Promise<void>;
  unregisterProcessCleanup: () => void;
};

export type RuntimeInstanceRegistryCleanupEntry =
  | { kind: 'temp-file'; fileModifiedAtMs: number; nowMs: number }
  | { kind: 'malformed-json'; fileModifiedAtMs: number; nowMs: number }
  | { kind: 'record'; fileModifiedAtMs: number; nowMs: number; record: unknown };

export type RuntimeInstanceRegistryCleanupDecision =
  | { action: 'keep' }
  | { action: 'remove' }
  | { action: 'check-pid'; pid: number };

export function getDefaultRuntimeInstanceRegistryDir() {
  return join(homedir(), '.storybook', 'instances');
}

export function getStorybookBaseUrl(address: string) {
  const url = new URL(address);
  return `${url.origin}${url.pathname.replace(/\/$/, '')}`;
}

export function getMcpMetadataFromMainConfig(
  mainConfig: Pick<StorybookConfig, 'addons'>
): RuntimeInstanceRecord['mcp'] {
  // Normalize entries so addons registered via `getAbsolutePath()` are recognized, not just bare names.
  const addon = mainConfig.addons?.find(
    (entry) => normalizeAddonName(entry) === STORYBOOK_MCP_ADDON
  );

  if (!addon) {
    return { status: 'not-installed' };
  }

  const endpoint =
    typeof addon === 'object' && typeof addon.options?.endpoint === 'string'
      ? addon.options.endpoint
      : DEFAULT_MCP_ENDPOINT;

  return { status: 'ready', endpoint };
}

function detectRuntimeInstanceAgent() {
  if (isClaudePreviewLaunch()) {
    return CLAUDE_PREVIEW_AGENT_NAME;
  }

  return detectAgent()?.name;
}

export function createRuntimeInstanceRecord({
  address,
  agent,
  configDir,
  cwd = process.cwd(),
  instanceId = randomUUID(),
  mcp = { status: 'not-installed' },
  now = new Date(),
  pid = process.pid,
  port,
  storybookPath = findStorybookPackageRoot(),
  storybookVersion,
  token,
}: {
  address: string;
  agent?: string;
  configDir?: string;
  cwd?: string;
  instanceId?: string;
  mcp?: RuntimeInstanceRecord['mcp'];
  now?: Date;
  pid?: number;
  port: number;
  storybookPath?: string;
  storybookVersion: string;
  token?: string;
}): RuntimeInstanceRecord {
  const storybookBaseUrl = getStorybookBaseUrl(address);
  const timestamp = now.toISOString();

  return {
    schemaVersion: 1,
    instanceId,
    pid,
    cwd: resolve(cwd),
    ...(configDir ? { configDir: resolve(cwd, configDir) } : {}),
    url: storybookBaseUrl,
    port,
    ...(token ? { token } : {}),
    ...(agent ? { agent } : {}),
    storybookVersion,
    ...(storybookPath ? { storybookPath } : {}),
    startedAt: timestamp,
    updatedAt: timestamp,
    mcp,
  };
}

export async function writeRuntimeInstanceRecord(
  record: RuntimeInstanceRecord,
  registryDir = getDefaultRuntimeInstanceRegistryDir()
) {
  await mkdir(registryDir, { recursive: true, mode: REGISTRY_DIR_MODE });
  // `mkdir` ignores `mode` for an existing dir and umask can clear bits, so modes are enforced.
  await restrictOwnerAccess(registryDir, REGISTRY_DIR_MODE);
  await cleanupRuntimeInstanceRegistry(registryDir);

  const recordPath = join(registryDir, `${record.instanceId}.json`);
  const tempPath = join(
    registryDir,
    `${record.instanceId}.${record.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`
  );

  try {
    await writeFile(tempPath, `${JSON.stringify(record, null, 2)}\n`, {
      encoding: 'utf-8',
      mode: RECORD_FILE_MODE,
    });
    await restrictOwnerAccess(tempPath, RECORD_FILE_MODE);
    await rename(tempPath, recordPath);
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  }

  return recordPath;
}

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getTimestampMs(record: Record<string, unknown>, key: 'updatedAt' | 'startedAt') {
  const value = record[key];

  if (typeof value !== 'string') {
    return undefined;
  }

  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function getRecordAgeMs(record: unknown, fileModifiedAtMs: number, nowMs: number) {
  const recordTimestampMs = isRecordObject(record)
    ? (getTimestampMs(record, 'updatedAt') ?? getTimestampMs(record, 'startedAt'))
    : undefined;

  return nowMs - (recordTimestampMs ?? fileModifiedAtMs);
}

function getRecordPid(record: unknown) {
  if (!isRecordObject(record) || typeof record.pid !== 'number') {
    return undefined;
  }

  return Number.isInteger(record.pid) && record.pid > 0 ? record.pid : undefined;
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error;
}

export function getRuntimeInstanceRegistryCleanupDecision(
  entry: RuntimeInstanceRegistryCleanupEntry
): RuntimeInstanceRegistryCleanupDecision {
  if (entry.kind === 'temp-file') {
    return entry.nowMs - entry.fileModifiedAtMs > ONE_DAY_MS
      ? { action: 'remove' }
      : { action: 'keep' };
  }

  if (entry.kind === 'malformed-json') {
    return entry.nowMs - entry.fileModifiedAtMs > SEVEN_DAYS_MS
      ? { action: 'remove' }
      : { action: 'keep' };
  }

  const recordAgeMs = getRecordAgeMs(entry.record, entry.fileModifiedAtMs, entry.nowMs);

  if (recordAgeMs > SEVEN_DAYS_MS) {
    return { action: 'remove' };
  }

  if (recordAgeMs < ONE_DAY_MS) {
    return { action: 'keep' };
  }

  const recordPid = getRecordPid(entry.record);

  return recordPid === undefined ? { action: 'keep' } : { action: 'check-pid', pid: recordPid };
}

function isPidInactive(pid: number) {
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return isErrnoException(error) && error.code === 'ESRCH';
  }
}

async function applyCleanupDecision(
  recordPath: string,
  decision: RuntimeInstanceRegistryCleanupDecision
) {
  if (
    decision.action === 'remove' ||
    (decision.action === 'check-pid' && isPidInactive(decision.pid))
  ) {
    await rm(recordPath, { force: true });
  }
}

async function cleanupRuntimeInstanceRegistry(registryDir: string) {
  const nowMs = Date.now();
  const entries = await readdir(registryDir, { withFileTypes: true }).catch(() => []);

  await Promise.all(
    entries.map(async (entry) => {
      if (!entry.isFile()) {
        return;
      }

      const recordPath = join(registryDir, entry.name);

      try {
        const { mtimeMs } = await stat(recordPath);

        if (entry.name.endsWith('.tmp')) {
          await applyCleanupDecision(
            recordPath,
            getRuntimeInstanceRegistryCleanupDecision({
              kind: 'temp-file',
              fileModifiedAtMs: mtimeMs,
              nowMs,
            })
          );
          return;
        }

        if (!entry.name.endsWith('.json')) {
          return;
        }

        const content = await readFile(recordPath, 'utf-8');
        let record: unknown;

        try {
          record = JSON.parse(content) as unknown;
        } catch {
          await applyCleanupDecision(
            recordPath,
            getRuntimeInstanceRegistryCleanupDecision({
              kind: 'malformed-json',
              fileModifiedAtMs: mtimeMs,
              nowMs,
            })
          );
          return;
        }

        await applyCleanupDecision(
          recordPath,
          getRuntimeInstanceRegistryCleanupDecision({
            kind: 'record',
            fileModifiedAtMs: mtimeMs,
            nowMs,
            record,
          })
        );
      } catch {
        // Registry cleanup is opportunistic; one bad file should not block the current record.
      }
    })
  );
}

function registerProcessCleanup(recordPath: string) {
  const cleanupSync = () => {
    if (existsSync(recordPath)) {
      rmSync(recordPath, { force: true });
    }
  };

  process.once('exit', cleanupSync);
  process.prependOnceListener('SIGINT', cleanupSync);
  process.prependOnceListener('SIGTERM', cleanupSync);

  return () => {
    process.off('exit', cleanupSync);
    process.off('SIGINT', cleanupSync);
    process.off('SIGTERM', cleanupSync);
  };
}

export async function writeStorybookRuntimeInstanceRecord({
  address,
  agent = detectRuntimeInstanceAgent(),
  configDir,
  cwd,
  mcp,
  pid,
  port,
  registryDir,
  registerCleanup = true,
  storybookVersion,
  token,
}: {
  address: string;
  agent?: string;
  configDir?: string;
  cwd?: string;
  mcp?: RuntimeInstanceRecord['mcp'];
  pid?: number;
  port: number;
  registryDir?: string;
  registerCleanup?: boolean;
  storybookVersion: string;
  token: string;
}): Promise<RuntimeInstanceRegistration> {
  const record = createRuntimeInstanceRecord({
    address,
    agent,
    configDir,
    cwd,
    mcp,
    pid,
    port,
    storybookVersion,
    token,
  });
  const recordPath = await writeRuntimeInstanceRecord(record, registryDir);
  const unregisterProcessCleanup = registerCleanup ? registerProcessCleanup(recordPath) : () => {};

  return {
    record,
    recordPath,
    unregisterProcessCleanup,
    cleanup: async () => {
      unregisterProcessCleanup();
      await rm(recordPath, { force: true });
    },
  };
}
