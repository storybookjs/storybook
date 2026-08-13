import * as fs from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import * as v from 'valibot';

import { type StorybookInstanceRecord, StorybookInstanceRecordSchema } from './types.ts';

/**
 * Must stay in sync with `getDefaultRuntimeInstanceRegistryDir` in
 * `code/core/src/core-server/utils/runtime-instance-registry.ts` (the writer side). Duplicated
 * here so this reader does not pull the core-server module graph into the CLI's unit tests; the
 * path is specified in storybookjs/storybook#34826.
 */
export const DEFAULT_REGISTRY_DIR = join(homedir(), '.storybook', 'instances');

/**
 * Errno codes for which we degrade to "no instance" rather than throwing. The command is meant to
 * fail-soft for environmental issues; a noisy stack trace would be worse UX than the
 * missing-instance repair instructions.
 */
const SOFT_REGISTRY_ERRORS = new Set(['ENOENT', 'EACCES', 'EPERM', 'ENOTDIR']);

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
          const parsed = v.safeParse(StorybookInstanceRecordSchema, JSON.parse(raw));
          if (!parsed.success) {
            return null;
          }
          if (!isProcessAlive(parsed.output.pid)) {
            await fs.rm(join(registryDir, name), { force: true }).catch(() => {});
            return null;
          }
          return parsed.output;
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
