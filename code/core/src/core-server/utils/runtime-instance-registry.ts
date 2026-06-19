import { existsSync, rmSync } from 'node:fs';
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';

import type { StorybookConfig } from 'storybook/internal/types';

import { join, resolve } from 'pathe';

import { detectAgent } from '../../telemetry/detect-agent.ts';

const STORYBOOK_MCP_ADDON = '@storybook/addon-mcp';
const DEFAULT_MCP_ENDPOINT = '/mcp';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;
const CLAUDE_PREVIEW_AGENT = 'claude-preview';

export type RuntimeInstanceRecord = {
  schemaVersion: 1;
  instanceId: string;
  pid: number;
  cwd: string;
  url: string;
  port: number;
  agent?: string;
  storybookVersion: string;
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

export function getOrigin(address: string) {
  return new URL(address).origin;
}

export function getMcpMetadataFromMainConfig(
  mainConfig: Pick<StorybookConfig, 'addons'>
): RuntimeInstanceRecord['mcp'] {
  const addon = mainConfig.addons?.find(
    (entry) =>
      entry === STORYBOOK_MCP_ADDON ||
      (typeof entry === 'object' && entry.name === STORYBOOK_MCP_ADDON)
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

export function detectRuntimeInstanceAgent() {
  if (process.env.CLAUDE_AGENT_SDK_VERSION && !process.env.AI_AGENT) {
    return CLAUDE_PREVIEW_AGENT;
  }

  return detectAgent()?.name;
}

export function createRuntimeInstanceRecord({
  address,
  agent,
  cwd = process.cwd(),
  instanceId = randomUUID(),
  mcp = { status: 'not-installed' },
  now = new Date(),
  pid = process.pid,
  port,
  storybookVersion,
}: {
  address: string;
  agent?: string;
  cwd?: string;
  instanceId?: string;
  mcp?: RuntimeInstanceRecord['mcp'];
  now?: Date;
  pid?: number;
  port: number;
  storybookVersion: string;
}): RuntimeInstanceRecord {
  const origin = getOrigin(address);
  const timestamp = now.toISOString();

  return {
    schemaVersion: 1,
    instanceId,
    pid,
    cwd: resolve(cwd),
    url: origin,
    port,
    ...(agent ? { agent } : {}),
    storybookVersion,
    startedAt: timestamp,
    updatedAt: timestamp,
    mcp,
  };
}

export async function writeRuntimeInstanceRecord(
  record: RuntimeInstanceRecord,
  registryDir = getDefaultRuntimeInstanceRegistryDir()
) {
  await mkdir(registryDir, { recursive: true });
  await cleanupRuntimeInstanceRegistry(registryDir);

  const recordPath = join(registryDir, `${record.instanceId}.json`);
  const tempPath = join(
    registryDir,
    `${record.instanceId}.${record.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`
  );

  try {
    await writeFile(tempPath, `${JSON.stringify(record, null, 2)}\n`, 'utf-8');
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
  cwd,
  mcp,
  pid,
  port,
  registryDir,
  registerCleanup = true,
  storybookVersion,
}: {
  address: string;
  agent?: string;
  cwd?: string;
  mcp?: RuntimeInstanceRecord['mcp'];
  pid?: number;
  port: number;
  registryDir?: string;
  registerCleanup?: boolean;
  storybookVersion: string;
}): Promise<RuntimeInstanceRegistration> {
  const record = createRuntimeInstanceRecord({
    address,
    agent,
    cwd,
    mcp,
    pid,
    port,
    storybookVersion,
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
