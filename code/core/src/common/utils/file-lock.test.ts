// Real temp directories, not memfs: this module is about filesystem semantics memfs does not model
// (`O_EXCL` creation, mtime), and the lock exists to exclude other OS processes, which a per-process
// virtual filesystem cannot represent at all. Cross-process behaviour is in the sibling test.
// The one exception is the stale-break race below: a wall-clock mtime made that test itself flaky
// on loaded Windows CI, so the block virtualizes mtime through the `node:fs/promises` mock while
// keeping real files, real `O_EXCL` creation and real payloads.
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
  type PathLike,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as realSleep } from 'node:timers/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { withFileLock, type FileLockOptions } from './file-lock.ts';

/** Shared state for the `node:fs/promises` mock below; only the stale-break block arms it. */
const clock = vi.hoisted(
  (): {
    armed: boolean;
    mtimeMs: number;
    mtimeTracksNow: boolean;
    failHeartbeats: boolean;
    successorPayload: string | undefined;
    successorReadsBefore: number;
  } => ({
    armed: false,
    mtimeMs: 0,
    mtimeTracksNow: false,
    failHeartbeats: false,
    successorPayload: undefined,
    successorReadsBefore: 0,
  })
);

// Pass-through mock: every test runs against the real filesystem unless it arms the clock, in
// which case `stat`/`utimes`/`readFile` are diverted just enough to make the heartbeat-versus-
// stale-break race deterministic (a virtual mtime instead of a wall-clock one, and a scripted
// payload swap for the successor case).
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  const { writeFileSync } = await import('node:fs');

  return {
    ...actual,
    stat: vi.fn(async (path: PathLike) => {
      const stats = await actual.stat(path);
      if (!clock.armed) {
        return stats;
      }
      return { ...stats, mtimeMs: clock.mtimeTracksNow ? Date.now() : clock.mtimeMs };
    }),
    utimes: vi.fn(async (path: PathLike, atime: Date, mtime: Date) => {
      if (!clock.armed) {
        return actual.utimes(path, atime, mtime);
      }
      if (clock.failHeartbeats) {
        throw Object.assign(new Error('simulated heartbeat failure'), { code: 'EPERM' });
      }
      clock.mtimeMs = mtime.getTime();
    }),
    readFile: vi.fn(async (path: PathLike, encoding?: BufferEncoding) => {
      if (clock.armed && clock.successorPayload !== undefined) {
        if (clock.successorReadsBefore > 0) {
          clock.successorReadsBefore -= 1;
        } else {
          // A successor broke the stale lock and re-took it between the waiter's two payload
          // reads: its payload is what the waiter sees from here on, and its fresh lock file is
          // now on disk.
          const successor = clock.successorPayload;
          clock.successorPayload = undefined;
          writeFileSync(String(path), successor);
          clock.mtimeTracksNow = true;
          return successor;
        }
      }
      return actual.readFile(path, encoding);
    }),
  };
});

let workDir: string;
let lockPath: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'sb-file-lock-'));
  lockPath = join(workDir, '.work.lock');
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

const noop = async () => {};

/** Ages a lock file so the stale-break paths are reachable without waiting out a real window. */
const backdate = (path: string, byMs: number) => {
  const when = new Date(Date.now() - byMs);
  utimesSync(path, when, when);
};

describe('withFileLock', () => {
  it('runs the work under the lock and removes the lock afterwards', async () => {
    const outcome = await withFileLock(lockPath, async () => {
      expect(existsSync(lockPath)).toBe(true);
    });

    expect(outcome).toBe('ran');
    expect(existsSync(lockPath)).toBe(false);
  });

  it('creates the lock directory, so the very first caller does not have to', async () => {
    const nested = join(workDir, 'dist', 'docs', '.work.lock');

    await expect(withFileLock(nested, noop)).resolves.toBe('ran');
  });

  it('releases the lock when the work throws, instead of wedging every later caller', async () => {
    await expect(
      withFileLock(lockPath, async () => {
        throw new Error('the work exploded');
      })
    ).rejects.toThrow('the work exploded');

    expect(existsSync(lockPath)).toBe(false);
  });

  it('gives up when a live holder keeps the lock past the wait budget', async () => {
    // A lock held by this very process, so the liveness check says the holder is alive.
    writeFileSync(lockPath, JSON.stringify({ token: 'someone-else', pid: process.pid }));
    const run = vi.fn(noop);

    const outcome = await withFileLock(lockPath, run, { waitBudgetMs: 100 });

    expect(outcome).toBe('busy');
    expect(run).not.toHaveBeenCalled();
    // Not ours to remove: the holder is still working behind it.
    expect(existsSync(lockPath)).toBe(true);
  });

  it('breaks a lock whose holder is gone, which is what SIGKILL leaves behind', async () => {
    // Far above any platform's pid ceiling, so the liveness check reports the holder as gone.
    writeFileSync(lockPath, JSON.stringify({ token: 'dead', pid: 0x7ffffffe }));

    await expect(withFileLock(lockPath, noop, { waitBudgetMs: 1000 })).resolves.toBe('ran');
  });

  it('breaks a lock that has sat untouched past the stale window, for a recycled pid', async () => {
    writeFileSync(lockPath, JSON.stringify({ token: 'recycled', pid: process.pid }));
    backdate(lockPath, 60_000);

    await expect(withFileLock(lockPath, noop, { waitBudgetMs: 1000 })).resolves.toBe('ran');
  });

  it('waits out a payload-less lock, then breaks it once past the grace window', async () => {
    // A crash between creating the lock file and writing its payload leaves one with no pid to test
    // for liveness. A fresh one is more likely a writer we caught mid-creation, so it is left alone.
    writeFileSync(lockPath, '');
    await expect(withFileLock(lockPath, noop, { waitBudgetMs: 150 })).resolves.toBe('busy');

    backdate(lockPath, 60_000);
    await expect(withFileLock(lockPath, noop, { waitBudgetMs: 1000 })).resolves.toBe('ran');
  });

  // Wall-clock mtimes made the original version of this block flaky on loaded Windows CI: the
  // waiter judged a live holder abandoned when one heartbeat beat landed late (CircleCI job
  // 2424607). These tests run the same race on a virtual clock, so machine load can no longer
  // change the outcome: heartbeats and staleness only move when the test moves them.
  describe('the stale-break race', () => {
    beforeEach(() => {
      vi.useFakeTimers({
        toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
      });
      clock.armed = true;
      clock.mtimeMs = Date.now();
    });

    afterEach(() => {
      clock.armed = false;
      clock.mtimeTracksNow = false;
      clock.failHeartbeats = false;
      clock.successorPayload = undefined;
      clock.successorReadsBefore = 0;
      vi.useRealTimers();
    });

    /** Waits in real time for real-fs work to land: fake timers do not patch
     * `node:timers/promises`, and the event loop processes threadpool completions while it sleeps. */
    const waitFor = async (condition: () => boolean, description: string) => {
      for (let i = 0; i < 200 && !condition(); i += 1) {
        await realSleep(5);
      }
      expect(condition(), description).toBe(true);
    };

    /** Drives a competing caller to completion: fake-time advances move its poll loop and the
     * heartbeat, and the real sleeps let the real-fs steps (open, payload read, removal) land
     * in between. */
    const settleWaiter = async (waiter: Promise<'ran' | 'busy'>) => {
      let outcome: 'ran' | 'busy' | undefined;
      let failure: unknown;
      waiter.then(
        (value) => {
          outcome = value;
        },
        (error) => {
          failure = error;
        }
      );
      for (let i = 0; i < 100 && outcome === undefined && failure === undefined; i += 1) {
        await vi.advanceTimersByTimeAsync(50);
        await realSleep(5);
      }
      if (failure !== undefined) {
        throw failure;
      }
      if (outcome === undefined) {
        throw new Error('the competing caller never settled');
      }
      return outcome;
    };

    /** A holder that keeps reporting until the test releases it, so "still inside" is provable. */
    const holdUntilReleased = async (options: FileLockOptions) => {
      let releaseHolder: () => void = () => {};
      const held = new Promise<void>((resolve) => {
        releaseHolder = resolve;
      });
      let entered = false;
      const done = withFileLock(
        lockPath,
        async () => {
          entered = true;
          await held;
        },
        options
      );
      await waitFor(() => entered, 'the holder acquired the lock and entered the work');
      return { done, release: releaseHolder };
    };

    it('does not break a live holder`s lock just because the work outlasts the stale window', async () => {
      const holder = await holdUntilReleased({ staleAfterMs: 150 });

      const waiterWork = vi.fn();
      const waiter = withFileLock(lockPath, waiterWork, { waitBudgetMs: 2000, staleAfterMs: 150 });
      // The heartbeat refreshes the lock every 50ms, so the observed age never exceeds one beat
      // and the waiter stays out until its wait budget is spent.
      expect(await settleWaiter(waiter)).toBe('busy');
      expect(waiterWork).not.toHaveBeenCalled();
      expect(existsSync(lockPath)).toBe(true);

      holder.release();
      await expect(holder.done).resolves.toBe('ran');
      expect(existsSync(lockPath)).toBe(false);
    });

    it('breaks the lock once the holder stops reporting, even though its pid is alive', async () => {
      const holder = await holdUntilReleased({ staleAfterMs: 150 });

      const waiterWork = vi.fn();
      const waiter = withFileLock(lockPath, waiterWork, { waitBudgetMs: 2000, staleAfterMs: 150 });
      // Two healthy heartbeats land, then every heartbeat write starts failing, which is exactly
      // the failure `holdLock` swallows. The holder is alive but no longer reporting, so its lock
      // must go stale and be broken.
      await vi.advanceTimersByTimeAsync(100);
      await realSleep(20);
      clock.failHeartbeats = true;

      expect(await settleWaiter(waiter)).toBe('ran');
      expect(waiterWork).toHaveBeenCalledTimes(1); // the waiter entered while the holder still is

      holder.release();
      await expect(holder.done).resolves.toBe('ran'); // the swallowed heartbeat errors never hurt it
      expect(existsSync(lockPath)).toBe(false);
    });

    it('does not delete a lock whose token changes under the waiter', async () => {
      // A stale lock from a first holder; between the waiter's two payload reads a successor
      // breaks and re-takes the lock. The readFile branch of the mock stands in for the
      // successor's write, which makes the interleaving deterministic.
      writeFileSync(lockPath, JSON.stringify({ token: 'first-holder', pid: process.pid }));
      clock.mtimeMs = Date.now() - 60_000;
      clock.successorPayload = JSON.stringify({ token: 'successor', pid: process.pid });
      clock.successorReadsBefore = 1; // the waiter's first read still sees the original payload

      const waiterWork = vi.fn();
      const waiter = withFileLock(lockPath, waiterWork, { waitBudgetMs: 500, staleAfterMs: 150 });
      expect(await settleWaiter(waiter)).toBe('busy');
      expect(waiterWork).not.toHaveBeenCalled();
      expect(JSON.parse(readFileSync(lockPath, 'utf8')).token).toBe('successor');
    });
  });

  it('does not delete a lock it no longer owns', async () => {
    // Once a holder's lock has been broken and re-taken, releasing by path would drop the successor's
    // lock and leave the critical section unguarded for whoever comes next.
    await withFileLock(lockPath, async () => {
      writeFileSync(lockPath, JSON.stringify({ token: 'someone-else', pid: process.pid }));
    });

    expect(JSON.parse(readFileSync(lockPath, 'utf8')).token).toBe('someone-else');
  });
});
