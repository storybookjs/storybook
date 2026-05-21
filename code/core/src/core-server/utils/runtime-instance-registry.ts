import { existsSync, rmSync } from 'node:fs';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';

import { join, resolve } from 'pathe';

import { getAddonNames } from '../../common/utils/get-addon-names.ts';
import type { StorybookConfig } from '../../types/modules/core-common.ts';

const STORYBOOK_MCP_ADDON = '@storybook/addon-mcp';

export type RuntimeInstanceRecord = {
  schemaVersion: 1;
  instanceId: string;
  pid: number;
  cwd: string;
  url: string;
  port: number;
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

export function getDefaultRuntimeInstanceRegistryDir() {
  return join(homedir(), '.storybook', 'instances');
}

export function getOrigin(address: string) {
  return new URL(address).origin;
}

export function getMcpState(
  mainConfig: StorybookConfig,
  origin: string
): RuntimeInstanceRecord['mcp'] {
  const addons = getAddonNames(mainConfig);

  if (addons.includes(STORYBOOK_MCP_ADDON)) {
    return { status: 'ready', endpoint: `${origin}/mcp` };
  }

  return { status: 'not-installed' };
}

export function createRuntimeInstanceRecord({
  address,
  cwd = process.cwd(),
  instanceId = randomUUID(),
  mainConfig,
  now = new Date(),
  pid = process.pid,
  port,
  storybookVersion,
}: {
  address: string;
  cwd?: string;
  instanceId?: string;
  mainConfig: StorybookConfig;
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
    storybookVersion,
    startedAt: timestamp,
    updatedAt: timestamp,
    mcp: getMcpState(mainConfig, origin),
  };
}

export async function writeRuntimeInstanceRecord(
  record: RuntimeInstanceRecord,
  registryDir = getDefaultRuntimeInstanceRegistryDir()
) {
  await mkdir(registryDir, { recursive: true });

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
  cwd,
  mainConfig,
  pid,
  port,
  registryDir,
  registerCleanup = true,
  storybookVersion,
}: {
  address: string;
  cwd?: string;
  mainConfig: StorybookConfig;
  pid?: number;
  port: number;
  registryDir?: string;
  registerCleanup?: boolean;
  storybookVersion: string;
}): Promise<RuntimeInstanceRegistration> {
  const record = createRuntimeInstanceRecord({
    address,
    cwd,
    mainConfig,
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
