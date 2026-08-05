/**
 * Cross-process advisory lock, built on `O_EXCL` file creation.
 *
 * The work this guards is a whole-project Compodoc run, and the callers that collide over it live in
 * different OS processes: `storybook dev` and the Vitest addon's child both reach the "no
 * documentation.json yet" branch at cold start, and a standalone `vitest` run is a third. Even
 * inside one process the docgen worker is a separate thread with its own module registry, so a
 * promise memo in module scope is not shared with the preset on the main thread. Nothing short of a
 * filesystem lock excludes all of them.
 *
 * A holder keeps the lock's mtime fresh while it works, so "stale" means "the holder stopped
 * reporting", not "the work is taking a while". Without that a long scan breaks its own lock and two
 * runs proceed at once, which is the failure the lock exists to prevent.
 */
import { logger } from 'storybook/internal/node-logger';

import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { mkdir, open, readFile, rm, stat, utimes } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Lock-file payload. `token` identifies one acquisition, so a holder only ever removes the lock it
 * still owns; `pid` drives liveness detection and `createdAt` is there for anyone debugging a stuck
 * lock.
 */
interface LockPayload {
  token: string;
  pid: number;
  createdAt: number;
}

export interface FileLockOptions {
  /** How long a caller waits for the current holder before giving up and returning `timed-out`. */
  waitBudgetMs?: number;
  /**
   * How long a lock may go without a heartbeat before it is treated as abandoned. Because a live
   * holder refreshes it continuously, reaching this means the holder died without cleaning up.
   */
  staleAfterMs?: number;
  pollIntervalMs?: number;
}

export type FileLockOutcome<T> =
  /** We held the lock and ran the work. */
  | { status: 'ran'; result: T }
  /** We held the lock, but `shouldRun` said the work was already done. */
  | { status: 'skipped' }
  /** Someone else held the lock for longer than the wait budget allowed. */
  | { status: 'timed-out' };

const DEFAULT_POLL_INTERVAL_MS = 50;
/** Three missed heartbeats. Short, because a live holder keeps its lock fresh no matter how long it runs. */
const DEFAULT_STALE_AFTER_MS = 30_000;
const DEFAULT_WAIT_BUDGET_MS = 10 * 60 * 1000;
/**
 * How long a lock carrying no readable payload is tolerated. A crash between creating the file and
 * writing it leaves one behind with no pid to check, and the only other reader of an empty lock is a
 * caller that raced the write by microseconds - hence a grace window rather than an instant break.
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
    return JSON.parse(await readFile(lockPath, 'utf8')) as LockPayload;
  } catch {
    return undefined;
  }
};

/**
 * Creates the lock file exclusively. Returns the acquisition's token, or `undefined` when someone
 * else got there first.
 */
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

  const payload: LockPayload = { token: randomUUID(), pid: process.pid, createdAt: Date.now() };
  try {
    await handle.writeFile(JSON.stringify(payload));
  } catch (error) {
    // A lock with no payload cannot be attributed to anyone, so every later caller would have to
    // wait out the stale window instead of seeing that nobody holds it. Take it back down.
    await handle.close();
    await rm(lockPath, { force: true }).catch((): undefined => undefined);
    throw error;
  }
  await handle.close();
  return payload.token;
};

/**
 * Clears a lock whose holder can no longer finish, and reports whether acquisition is worth
 * retrying immediately. A holder killed with `SIGKILL` leaves the file behind with no chance to run
 * cleanup, so the recorded pid's liveness is the primary signal; the heartbeat age covers a pid the
 * OS has since handed to something else, and the grace window covers a lock that was never written.
 */
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
      : // No readable payload: the writer crashed mid-create, or we caught it between the two calls.
        age > MALFORMED_LOCK_GRACE_MS;

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
  logger.debug(
    `[storybook-angular-vite] cleared an abandoned lock at ${lockPath} (holder pid ${holderPid ?? 'unknown'})`
  );
  return true;
};

/**
 * Keeps the lock's mtime current while the work runs, and removes it on release.
 *
 * Release is conditional on the payload still carrying our token, so a holder whose lock was broken
 * for it - it overran the stale window, or its pid was misread as dead - cannot delete the successor's
 * lock on the way out.
 *
 * The `exit` listener only covers a clean exit. Node does not run `exit` listeners when the process
 * is terminated by a signal, so a `SIGINT` or `SIGKILL` leaves the file behind and the stale-break
 * above is what recovers it.
 */
const holdLock = (lockPath: string, token: string, staleAfterMs: number) => {
  const removeSync = () => rmSync(lockPath, { force: true });
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

  return async () => {
    clearInterval(heartbeat);
    process.off('exit', removeSync);
    const current = await readPayload(lockPath);
    if (current?.token === token) {
      await rm(lockPath, { force: true });
    }
  };
};

/**
 * Runs `run` under the lock at `lockPath`, at most once across every process that shares it.
 *
 * `shouldRun` is evaluated *after* the lock is held, which is what lets every waiter end up with the
 * winner's output instead of repeating the work: the winner sees work to do and does it, and each
 * waiter acquires afterwards, sees it already done, and returns `skipped`. A caller that cannot
 * acquire within `waitBudgetMs` gets `timed-out` and is expected to carry on without the result
 * rather than block indefinitely.
 */
export const withFileLock = async <T>(
  lockPath: string,
  {
    shouldRun,
    run,
  }: {
    shouldRun: () => boolean | Promise<boolean>;
    run: () => Promise<T>;
  },
  options: FileLockOptions = {}
): Promise<FileLockOutcome<T>> => {
  const {
    waitBudgetMs = DEFAULT_WAIT_BUDGET_MS,
    staleAfterMs = DEFAULT_STALE_AFTER_MS,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  } = options;
  const deadline = Date.now() + waitBudgetMs;

  for (;;) {
    const token = await tryAcquire(lockPath);
    if (token !== undefined) {
      const release = holdLock(lockPath, token, staleAfterMs);
      try {
        if (!(await shouldRun())) {
          return { status: 'skipped' };
        }
        return { status: 'ran', result: await run() };
      } finally {
        await release();
      }
    }

    const retryImmediately = await breakStaleLock(lockPath, staleAfterMs);
    if (Date.now() >= deadline) {
      return { status: 'timed-out' };
    }
    if (!retryImmediately) {
      await delay(pollIntervalMs);
    }
  }
};
