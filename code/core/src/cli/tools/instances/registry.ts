import * as fs from 'node:fs/promises';
import { connect } from 'node:net';
import { join } from 'node:path';

import * as v from 'valibot';

import { detectBlockedNetwork } from '../../../common/utils/blocked-network.ts';
import {
  getInstanceRegistryDir,
  getLegacyStorybookConfigDir,
} from '../../../common/utils/storybook-config-dir.ts';
import { type StorybookInstanceRecord, StorybookInstanceRecordSchema } from './types.ts';

/**
 * Errno codes for which we degrade to "no instance" rather than throwing. The command is meant to
 * fail-soft for environmental issues; a noisy stack trace would be worse UX than the
 * missing-instance repair instructions.
 */
const SOFT_REGISTRY_ERRORS = new Set(['ENOENT', 'EACCES', 'EPERM', 'ENOTDIR']);

/**
 * Read all Storybook instance records from `registryDir` and, when it differs, from
 * `legacyRegistryDir` too — a dev server started before `XDG_STATE_HOME` was set (or one from an
 * older Storybook) still writes there.
 *
 * Each file is expected to be a single JSON object matching {@link StorybookInstanceRecord}.
 * Records whose PID is no longer alive are filtered out (and their files removed), unless the
 * system does not permit connecting to the record's port: then this process cannot tell, and
 * attach reports the refusal. Malformed files are skipped silently — the command should degrade to
 * "no instance" rather than fail loudly.
 */
export async function readRegistry(
  registryDir: string = getInstanceRegistryDir(),
  legacyRegistryDir: string = join(getLegacyStorybookConfigDir(), 'instances')
): Promise<StorybookInstanceRecord[]> {
  if (registryDir === legacyRegistryDir) {
    return readRegistryDir(registryDir);
  }

  const [current, legacy] = await Promise.all([
    readRegistryDir(registryDir),
    readRegistryDir(legacyRegistryDir),
  ]);

  return [...current, ...legacy];
}

async function readRegistryDir(registryDir: string): Promise<StorybookInstanceRecord[]> {
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
          if (!isProcessAlive(parsed.output.pid) && !(await connectIsBlocked(parsed.output))) {
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

const CONNECT_PROBE_TIMEOUT_MS = 1000;

// A sandbox with its own process namespace hides a dev server that runs outside it, and answers a
// connection to that server's port with `EPERM`. A server that is gone refuses the connection.
function connectIsBlocked({ port }: StorybookInstanceRecord): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host: '127.0.0.1', port });
    const settle = (blocked: boolean) => {
      socket.destroy();
      resolve(blocked);
    };
    socket.setTimeout(CONNECT_PROBE_TIMEOUT_MS, () => settle(false));
    socket.once('connect', () => settle(false));
    socket.once('error', (error) => settle(detectBlockedNetwork(error) !== undefined));
  });
}
