import * as fs from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { McpStatus, StorybookInstanceRecord } from './types.ts';

export const DEFAULT_REGISTRY_DIR = join(homedir(), '.storybook', 'instances');

/**
 * Errno codes for which we degrade to "no instance" rather than throwing. The command is meant to
 * fail-soft for environmental issues; a noisy stack trace would be worse UX than the
 * missing-instance repair instructions.
 */
const SOFT_REGISTRY_ERRORS = new Set(['ENOENT', 'EACCES', 'EPERM', 'ENOTDIR']);

const MCP_STATUSES: McpStatus[] = ['not-installed', 'starting', 'ready', 'error'];

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

/** Validate a parsed registry file against the record shape; null for anything malformed. */
export function parseInstanceRecord(value: unknown): StorybookInstanceRecord | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const mcp = record.mcp as Record<string, unknown> | null | undefined;

  const isValid =
    record.schemaVersion === 1 &&
    typeof record.instanceId === 'string' &&
    isIntegerInRange(record.pid, 1, Number.MAX_SAFE_INTEGER) &&
    typeof record.cwd === 'string' &&
    typeof record.url === 'string' &&
    isIntegerInRange(record.port, 1, 65535) &&
    isOptionalString(record.storybookVersion) &&
    isOptionalString(record.startedAt) &&
    isOptionalString(record.updatedAt) &&
    typeof mcp === 'object' &&
    mcp !== null &&
    MCP_STATUSES.includes(mcp.status as McpStatus) &&
    isOptionalString(mcp.endpoint);

  return isValid ? (value as StorybookInstanceRecord) : null;
}

/**
 * Read all Storybook instance records from `registryDir`.
 *
 * Each file is expected to be a single JSON object matching {@link StorybookInstanceRecord}.
 * Records whose PID is no longer alive are filtered out (and their files removed). Malformed files
 * are skipped silently — the command should degrade to "no instance" rather than fail loudly.
 */
export async function readRegistry(
  registryDir: string = DEFAULT_REGISTRY_DIR
): Promise<StorybookInstanceRecord[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(registryDir);
  } catch (error) {
    if (SOFT_REGISTRY_ERRORS.has((error as NodeJS.ErrnoException).code ?? '')) {
      return [];
    }
    throw error;
  }

  const records = await Promise.all(
    entries
      .filter((name) => name.endsWith('.json'))
      .map(async (name) => {
        try {
          const raw = await fs.readFile(join(registryDir, name), 'utf-8');
          const record = parseInstanceRecord(JSON.parse(raw));
          if (!record) {
            return null;
          }
          if (!isProcessAlive(record.pid)) {
            await fs.rm(join(registryDir, name), { force: true }).catch(() => {});
            return null;
          }
          return record;
        } catch {
          return null;
        }
      })
  );

  return records.filter((r): r is StorybookInstanceRecord => r !== null);
}

/**
 * Liveness check by sending signal 0. `EPERM` means the PID exists but we lack permission to
 * signal it (foreign user), which still counts as alive.
 */
function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}
