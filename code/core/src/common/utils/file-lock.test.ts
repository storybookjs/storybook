// Real temp directories, not memfs: this module is about filesystem semantics memfs does not model
// (`O_EXCL` creation, mtime), and the lock exists to exclude other OS processes, which a per-process
// virtual filesystem cannot represent at all. Cross-process behaviour is in the sibling test.
// The one exception is the stale-break race below: a wall-clock mtime made that test itself flaky
// on loaded Windows CI, so that block spies the `node:fs/promises` functions it needs (per
// .cursor/rules/spy-mocking.mdc, with implementations installed in its beforeEach) and virtualizes
// mtime while keeping real files, real `O_EXCL` creation and real payloads.
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
  type PathLike,
} from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as realSleep } from 'node:timers/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { withFileLock, type FileLockOptions } from './file-lock.ts';

vi.mock('node:fs/promises', { spy: true });
const fsMock = vi.mocked(fsPromises);
const actualFs = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');

/** Shared state for the stale-break block's fs spies; reset by its beforeEach/afterEach. */
const clock = {
  mtimeMs: 0,
  mtimeTracksNow: false,
  failHeartbeats: false,
  successorPayload: undefined as string | undefined,
  successorReadsBefore: 0,
  /** Diverted fs calls started but not finished: time must not advance while any is in flight. */
  inFlight: 0,
};

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
      clock.mtimeMs = Date.now();
      clock.mtimeTracksNow = false;
      clock.failHeartbeats = false;
      clock.successorPayload = undefined;
      clock.successorReadsBefore = 0;
      clock.inFlight = 0;

      fsMock.stat.mockImplementation((path: PathLike) =>
        track(async () => {
          // A real Stats instance with its methods intact; only mtimeMs is virtualized.
          const stats = await actualFs.stat(path);
          const mtimeMs = clock.mtimeTracksNow ? Date.now() : clock.mtimeMs;
          return Object.assign(stats, { mtimeMs });
        })
      );
      fsMock.utimes.mockImplementation((path: PathLike, atime: Date, mtime: Date) =>
        track(async () => {
          if (clock.failHeartbeats) {
            throw Object.assign(new Error('simulated heartbeat failure'), { code: 'EPERM' });
          }
          // The beat itself is what keeps the virtual mtime fresh for the waiter's stat.
          clock.mtimeMs = mtime.getTime();
          await actualFs.utimes(path, atime, mtime);
        })
      );
      fsMock.readFile.mockImplementation((path: PathLike, encoding?: BufferEncoding) =>
        track(async () => {
          if (clock.successorReadsBefore > 0) {
            clock.successorReadsBefore -= 1;
            return actualFs.readFile(path, encoding);
          }
          if (clock.successorPayload !== undefined) {
            // A successor broke the stale lock and re-took it between the waiter's two payload
            // reads: its payload is what the waiter sees from here on, and its fresh lock file
            // is now on disk. The successor is a live holder, so from here on its heartbeats
            // keep the virtual mtime at now no matter how far the test advances the clock.
            const successor = clock.successorPayload;
            clock.successorPayload = undefined;
            writeFileSync(String(path), successor);
            clock.mtimeTracksNow = true;
            return successor;
          }
          return actualFs.readFile(path, encoding);
        })
      );
    });

    afterEach(() => {
      // Back to pass-through spies: the other tests in this file run against the real fs.
      fsMock.stat.mockReset();
      fsMock.utimes.mockReset();
      fsMock.readFile.mockReset();
      vi.useRealTimers();
    });

    /** Counts a diverted fs call from start to finish, so the clock helpers can tell when the
     * threadpool has drained and it is safe to move time. */
    const track = async <T>(work: () => Promise<T>): Promise<T> => {
      clock.inFlight += 1;
      try {
        return await work();
      } finally {
        clock.inFlight -= 1;
      }
    };

    /** Waits in real time for real-fs work to land: fake timers do not patch
     * `node:timers/promises`, and the event loop processes threadpool completions while it sleeps. */
    const waitFor = async (condition: () => boolean, description: string) => {
      for (let i = 0; i < 200 && !condition(); i += 1) {
        await realSleep(5);
      }
      expect(condition(), description).toBe(true);
    };

    /** Advances the virtual clock at explicit checkpoints: never while a diverted fs call is in
     * flight, because `breakStaleLock` computes the lock's age from a `stat` taken before its
     * payload read — an advance between the two would manufacture staleness that no heartbeat
     * could have prevented. */
    const advance = async (ms: number) => {
      await waitFor(() => clock.inFlight === 0, 'no diverted fs call in flight');
      await vi.advanceTimersByTimeAsync(ms);
      await waitFor(() => clock.inFlight === 0, 'fs work started by timers settled');
    };

    /** Drives a competing caller to completion: checkpointed fake-time advances move its poll loop
     * and the heartbeat, and the real sleeps inside `waitFor` let the real-fs steps (open, payload
     * read, removal) land in between. */
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
        await advance(50);
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
      try {
        await waitFor(() => entered, 'the holder acquired the lock and entered the work');
      } catch (error) {
        // The holder never proved it entered, but it may still be starting: let its work end so
        // nothing outlives the test. A rejection from `done` here is cleanup noise, not the
        // failure under test.
        releaseHolder();
        await done.catch(() => undefined);
        throw error;
      }
      return { done, release: releaseHolder };
    };

    it('does not break a live holder`s lock just because the work outlasts the stale window', async () => {
      const holder = await holdUntilReleased({ staleAfterMs: 150 });

      const waiterWork = vi.fn();
      const waiter = withFileLock(lockPath, waiterWork, { waitBudgetMs: 2000, staleAfterMs: 150 });
      // The heartbeat refreshes the virtual mtime every 50ms while the waiter's age is only read
      // at its own stat, so the observed age can never exceed one beat and the waiter stays out
      // until its wait budget is spent.
      try {
        expect(await settleWaiter(waiter)).toBe('busy');
        expect(waiterWork).not.toHaveBeenCalled();
        expect(existsSync(lockPath)).toBe(true);
      } finally {
        // Released on every path: a suspended holder must never outlive a failed assertion.
        holder.release();
        await holder.done;
      }
      expect(existsSync(lockPath)).toBe(false);
    });

    it('breaks the lock once the holder stops reporting, even though its pid is alive', async () => {
      const holder = await holdUntilReleased({ staleAfterMs: 150 });

      const waiterWork = vi.fn();
      const waiter = withFileLock(lockPath, waiterWork, { waitBudgetMs: 2000, staleAfterMs: 150 });
      // Two healthy heartbeats land, then every heartbeat write starts failing, which is exactly
      // the failure `holdLock` swallows. The holder is alive but no longer reporting, so its lock
      // must go stale and be broken.
      await advance(100);
      clock.failHeartbeats = true;

      try {
        expect(await settleWaiter(waiter)).toBe('ran');
        expect(waiterWork).toHaveBeenCalledTimes(1); // the waiter entered while the holder still is
      } finally {
        // Released on every path; resolving `done` proves the swallowed heartbeat errors
        // never hurt the holder.
        holder.release();
        await holder.done;
      }
      expect(existsSync(lockPath)).toBe(false);
    });

    it('does not delete a lock whose token changes under the waiter', async () => {
      // A stale lock from a first holder; between the waiter's two payload reads a successor
      // breaks and re-takes the lock. The readFile spy stands in for the successor's write,
      // which makes the interleaving deterministic.
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
