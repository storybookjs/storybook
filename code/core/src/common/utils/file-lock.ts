/**
 * Cross-process advisory lock, built on `O_EXCL` file creation.
 *
 * Use it when expensive work has to happen at most once across processes that cannot see each other:
 * a dev server, the Vitest addon's child and a standalone `vitest` all start independently and can
 * reach the same work at the same moment. An in-process promise memo does not cover that, and it does
 * not even cover one process, since a worker thread has its own module registry.
 */
import { logger } from 'storybook/internal/node-logger';

import { randomUUID } from 'node:crypto';
import { readFileSync, rmSync } from 'node:fs';
import { mkdir, open, readFile, rm, stat, utimes } from 'node:fs/promises';
import { dirname } from 'node:path';

/** `token` identifies one acquisition, so a holder only ever removes the lock it still owns. */
interface LockPayload {
  token: string;
  pid: number;
}

export interface FileLockOptions {
  /** How long to wait for the current holder before giving up. */
  waitBudgetMs?: number;
  /** How long a lock may go without a heartbeat before it is treated as abandoned. */
  staleAfterMs?: number;
}

const POLL_INTERVAL_MS = 50;
/** Three missed heartbeats. */
const DEFAULT_STALE_AFTER_MS = 30_000;
const DEFAULT_WAIT_BUDGET_MS = 20_000;
/**
 * How long a lock carrying no readable payload is tolerated. A crash between creating the file and
 * writing it leaves one behind with no pid to check, but so does reading it microseconds after a
 * healthy caller created it.
 */
const MALFORMED_LOCK_GRACE_MS = 5_000;

const errorCode = (error: unknown): string | undefined =>
  typeof error === 'object' && error !== null && 'code' in error
    ? (error as NodeJS.ErrnoException).code
    : undefined;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** `ESRCH` is the only answer that means "gone"; `EPERM` means it exists under another user. */
const isProcessAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return errorCode(error) !== 'ESRCH';
  }
};

const readPayload = async (lockPath: string): Promise<Partial<LockPayload> | undefined> => {
  try {
    return JSON.parse(await readFile(lockPath, 'utf8')) as Partial<LockPayload>;
  } catch {
    return undefined;
  }
};

/** Creates the lock file exclusively. Returns the acquisition's token, or `undefined` if someone else won. */
const tryAcquire = async (lockPath: string): Promise<string | undefined> => {
  await mkdir(dirname(lockPath), { recursive: true });

  let handle;
  try {
    handle = await open(lockPath, 'wx');
  } catch (error) {
    if (errorCode(error) === 'EEXIST') {
      return undefined;
    }
    throw error;
  }

  const payload: LockPayload = { token: randomUUID(), pid: process.pid };
  try {
    await handle.writeFile(JSON.stringify(payload));
  } catch (error) {
    // A lock with no payload cannot be attributed to anyone, so every later caller would have to wait
    // out the grace window instead of seeing that nobody holds it. Take it back down.
    await handle.close();
    await rm(lockPath, { force: true }).catch((): undefined => undefined);
    throw error;
  }
  await handle.close();
  return payload.token;
};

const breakStaleLock = async (lockPath: string, staleAfterMs: number): Promise<boolean> => {
  let stats;
  try {
    stats = await stat(lockPath);
  } catch (error) {
    // Released between our failed create and this stat, so try again straight away.
    return errorCode(error) === 'ENOENT';
  }

  const payload = await readPayload(lockPath);
  const holderPid = typeof payload?.pid === 'number' ? payload.pid : undefined;
  const age = Date.now() - stats.mtimeMs;

  const abandoned =
    holderPid !== undefined
      ? !isProcessAlive(holderPid) || age > staleAfterMs
      : age > MALFORMED_LOCK_GRACE_MS;

  if (!abandoned) {
    return false;
  }

  // Only remove the exact acquisition we inspected: another caller may have broken and re-taken the
  // lock in the meantime, and dropping that one would let two runs proceed at once.
  const current = await readPayload(lockPath);
  if (current?.token !== payload?.token) {
    return true;
  }

  await rm(lockPath, { force: true });
  logger.debug(`Cleared an abandoned lock at ${lockPath} (holder pid ${holderPid ?? 'unknown'})`);
  return true;
};

/** Removes the lock, but only while it still carries our token. */
const releaseIfOurs = (lockPath: string, token: string) => {
  try {
    const payload = JSON.parse(readFileSync(lockPath, 'utf8')) as Partial<LockPayload>;
    if (payload?.token === token) {
      rmSync(lockPath, { force: true });
    }
  } catch {
    // Already gone, or unreadable and therefore not ours to remove.
  }
};

const holdLock = (lockPath: string, token: string, staleAfterMs: number) => {
  const removeSync = () => releaseIfOurs(lockPath, token);
  process.once('exit', removeSync);

  // Three beats inside the stale window, so a single missed tick never looks like a dead holder.
  const heartbeat = setInterval(
    () => {
      const now = new Date();
      void utimes(lockPath, now, now).catch((): undefined => undefined);
    },
    Math.max(10, staleAfterMs / 3)
  );
  heartbeat.unref?.();

  return () => {
    clearInterval(heartbeat);
    process.off('exit', removeSync);
    removeSync();
  };
};

/**
 * Runs `run` under the lock at `lockPath`, at most once across every process that shares it.
 *
 * Returns `'busy'` when someone else held the lock for longer than the wait budget allowed, which
 * callers are expected to carry on from rather than treat as a failure. `run` decides for itself
 * whether there is still anything to do, since the winner may already have done it.
 */
export const withFileLock = async (
  lockPath: string,
  run: () => Promise<void>,
  {
    waitBudgetMs = DEFAULT_WAIT_BUDGET_MS,
    staleAfterMs = DEFAULT_STALE_AFTER_MS,
  }: FileLockOptions = {}
): Promise<'ran' | 'busy'> => {
  const deadline = Date.now() + waitBudgetMs;

  for (;;) {
    const token = await tryAcquire(lockPath);
    if (token !== undefined) {
      const release = holdLock(lockPath, token, staleAfterMs);
      try {
        await run();
        return 'ran';
      } finally {
        release();
      }
    }

    const retryImmediately = await breakStaleLock(lockPath, staleAfterMs);
    if (Date.now() >= deadline) {
      return 'busy';
    }
    if (!retryImmediately) {
      await delay(POLL_INTERVAL_MS);
    }
  }
};
