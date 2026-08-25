// Real temp directories, not memfs: this module is about filesystem semantics memfs does not model
// (`O_EXCL` creation, mtime), and the lock exists to exclude other OS processes, which a per-process
// virtual filesystem cannot represent at all. Cross-process behaviour is in the sibling test.
import { existsSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { withFileLock } from './file-lock.ts';

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

  it('does not break a live holder`s lock just because the work outlasts the stale window', async () => {
    // The lock's mtime is refreshed while the work runs, so "stale" means the holder stopped
    // reporting, not that the scan is slow. Without the heartbeat a long run breaks its own
    // lock and a second one starts alongside it, which is the whole failure this lock prevents.
    let concurrent = 0;
    let maxConcurrent = 0;

    const attempt = (workMs: number) =>
      withFileLock(
        lockPath,
        async () => {
          concurrent += 1;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          await new Promise((resolve) => setTimeout(resolve, workMs));
          concurrent -= 1;
        },
        { waitBudgetMs: 2000, staleAfterMs: 150 }
      );

    await Promise.all([attempt(600), attempt(1)]);

    expect(maxConcurrent).toBe(1);
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
