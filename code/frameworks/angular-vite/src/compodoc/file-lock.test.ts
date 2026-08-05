// Real temp directories, not memfs. This module is about filesystem semantics memfs does not model
// - `O_EXCL` creation, inode identity and mtime - and the lock exists to exclude other OS
// processes, which a per-process virtual filesystem cannot represent at all. Cross-process
// behaviour is covered in `file-lock.cross-process.test.ts`.
import { existsSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { withFileLock } from './file-lock.ts';

let workDir: string;
let lockPath: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'sb-file-lock-'));
  lockPath = join(workDir, '.compodoc.lock');
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

const alwaysRun = { shouldRun: () => true };

/** Ages a lock file so the stale-break paths are reachable without waiting out a real window. */
const backdate = (path: string, byMs: number) => {
  const when = new Date(Date.now() - byMs);
  utimesSync(path, when, when);
};

describe('withFileLock', () => {
  it('runs the work under the lock and removes the lock afterwards', async () => {
    const outcome = await withFileLock(lockPath, {
      ...alwaysRun,
      run: async () => {
        expect(existsSync(lockPath)).toBe(true);
        return 'done';
      },
    });

    expect(outcome).toEqual({ status: 'ran', result: 'done' });
    expect(existsSync(lockPath)).toBe(false);
  });

  it('creates the lock directory, so the very first caller does not have to', async () => {
    const nested = join(workDir, 'dist', 'docs', '.compodoc.lock');

    await expect(
      withFileLock(nested, { ...alwaysRun, run: async () => 'done' })
    ).resolves.toMatchObject({ status: 'ran' });
  });

  it('records the holder pid, which is how a later caller decides the lock is dead', async () => {
    let payload: unknown;
    await withFileLock(lockPath, {
      ...alwaysRun,
      run: async () => {
        payload = JSON.parse(readFileSync(lockPath, 'utf8'));
      },
    });

    expect(payload).toMatchObject({ pid: process.pid });
  });

  it('releases the lock when the work throws, instead of wedging every later caller', async () => {
    await expect(
      withFileLock(lockPath, {
        ...alwaysRun,
        run: async () => {
          throw new Error('compodoc exploded');
        },
      })
    ).rejects.toThrow('compodoc exploded');

    expect(existsSync(lockPath)).toBe(false);
  });

  it('skips the work when it is already done by the time the lock is held', async () => {
    const run = vi.fn(async () => 'done');

    const outcome = await withFileLock(lockPath, { shouldRun: () => false, run });

    expect(outcome).toEqual({ status: 'skipped' });
    expect(run).not.toHaveBeenCalled();
    expect(existsSync(lockPath)).toBe(false);
  });

  it('gives up when a live holder keeps the lock past the wait budget', async () => {
    // A lock held by this very process, so the liveness check says the holder is alive.
    writeFileSync(lockPath, JSON.stringify({ pid: process.pid, createdAt: Date.now() }));
    const run = vi.fn(async () => 'done');

    const outcome = await withFileLock(
      lockPath,
      { ...alwaysRun, run },
      { waitBudgetMs: 100, pollIntervalMs: 10 }
    );

    expect(outcome).toEqual({ status: 'timed-out' });
    expect(run).not.toHaveBeenCalled();
    // Not ours to remove: the holder is still working behind it.
    expect(existsSync(lockPath)).toBe(true);
  });

  it('breaks a lock whose holder is gone, which is what SIGKILL leaves behind', async () => {
    // Far above any platform's pid ceiling, so the liveness check reports the holder as gone.
    writeFileSync(lockPath, JSON.stringify({ pid: 0x7ffffffe, createdAt: Date.now() }));

    const outcome = await withFileLock(
      lockPath,
      { ...alwaysRun, run: async () => 'done' },
      { waitBudgetMs: 1000, pollIntervalMs: 10 }
    );

    expect(outcome).toEqual({ status: 'ran', result: 'done' });
  });

  it('breaks a lock that has sat untouched past the stale window, for a recycled pid', async () => {
    writeFileSync(lockPath, JSON.stringify({ pid: process.pid, createdAt: Date.now() }));

    const outcome = await withFileLock(
      lockPath,
      { ...alwaysRun, run: async () => 'done' },
      { waitBudgetMs: 1000, staleAfterMs: 0, pollIntervalMs: 10 }
    );

    expect(outcome).toEqual({ status: 'ran', result: 'done' });
  });

  it('breaks a lock whose payload cannot be read, once it is past the grace window', async () => {
    // A crash between creating the lock file and writing its payload leaves one with no pid to test
    // for liveness. Backdated rather than left fresh, because a lock this young is more likely to be
    // one we caught mid-creation than one that was abandoned.
    writeFileSync(lockPath, 'not json');
    backdate(lockPath, 60_000);

    const outcome = await withFileLock(
      lockPath,
      { ...alwaysRun, run: async () => 'done' },
      { waitBudgetMs: 1000, pollIntervalMs: 10 }
    );

    expect(outcome).toEqual({ status: 'ran', result: 'done' });
  });

  it('leaves a just-created payload-less lock alone, rather than racing its writer', async () => {
    writeFileSync(lockPath, '');

    const outcome = await withFileLock(
      lockPath,
      { ...alwaysRun, run: async () => 'done' },
      { waitBudgetMs: 300, pollIntervalMs: 10 }
    );

    expect(outcome).toEqual({ status: 'timed-out' });
  });

  it('does not break a live holder`s lock just because the work outlasts the stale window', async () => {
    // The lock's mtime is refreshed while the work runs, so "stale" means the holder stopped
    // reporting - not that the scan is slow. Without the heartbeat a long Compodoc run breaks its own
    // lock and a second one starts alongside it, which is the whole failure this lock prevents.
    let concurrent = 0;
    let maxConcurrent = 0;

    const attempt = (workMs: number) =>
      withFileLock(
        lockPath,
        {
          ...alwaysRun,
          run: async () => {
            concurrent += 1;
            maxConcurrent = Math.max(maxConcurrent, concurrent);
            await new Promise((resolve) => setTimeout(resolve, workMs));
            concurrent -= 1;
            return 'done';
          },
        },
        { waitBudgetMs: 2000, staleAfterMs: 150, pollIntervalMs: 10 }
      );

    const [first, second] = await Promise.all([attempt(600), attempt(1)]);

    expect(maxConcurrent).toBe(1);
    expect(first).toEqual({ status: 'ran', result: 'done' });
    expect(second).toEqual({ status: 'ran', result: 'done' });
  });

  it('does not delete a lock it no longer owns', async () => {
    // Once a holder's lock has been broken and re-taken, releasing by path would drop the successor's
    // lock and leave the critical section unguarded for whoever comes next.
    await withFileLock(lockPath, {
      ...alwaysRun,
      run: async () => {
        writeFileSync(lockPath, JSON.stringify({ token: 'someone-else', pid: process.pid }));
        return 'done';
      },
    });

    expect(existsSync(lockPath)).toBe(true);
    expect(JSON.parse(readFileSync(lockPath, 'utf8')).token).toBe('someone-else');
  });

  it('serialises overlapping callers in one process and lets only the first do the work', async () => {
    // The in-process case is the weaker half of the guarantee, but it is the half a single test can
    // observe directly: `shouldRun` flipping to false is exactly how waiters inherit the result.
    let running = 0;
    let overlapped = false;
    let done = false;

    const attempt = () =>
      withFileLock(
        lockPath,
        {
          shouldRun: () => !done,
          run: async () => {
            running += 1;
            overlapped ||= running > 1;
            await new Promise((resolve) => setTimeout(resolve, 30));
            running -= 1;
            done = true;
            return 'done';
          },
        },
        { pollIntervalMs: 5 }
      );

    const outcomes = await Promise.all([attempt(), attempt(), attempt()]);

    expect(overlapped).toBe(false);
    expect(outcomes.filter((outcome) => outcome.status === 'ran')).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === 'skipped')).toHaveLength(2);
  });
});
