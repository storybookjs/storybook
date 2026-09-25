import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  classifyRunError,
  countCollectedRuns,
  deleteRunDirs,
  readRunOutcome,
  readRunOutcomes,
} from './collected-runs.ts';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'collected-runs-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/** A run directory as the harness leaves it. */
function writeRun(
  name: string,
  options: { project?: boolean; result?: Record<string, unknown> | string | null } = {}
): string {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  if (options.project !== false) {
    mkdirSync(join(dir, 'project'));
  }
  const result = options.result === undefined ? { status: 'passed' } : options.result;
  if (result !== null) {
    writeFileSync(
      join(dir, 'result.json'),
      typeof result === 'string' ? result : JSON.stringify(result)
    );
  }
  return dir;
}

describe('readRunOutcome', () => {
  it('counts a run that left a project tree behind', () => {
    expect(readRunOutcome(writeRun('run-1'))).toMatchObject({ collected: true, error: null });
  });

  // The tree is what every metric is measured from, so a run without one is not
  // a measurement — however the harness labelled it.
  it('does not count a run that left no project tree', () => {
    const dir = writeRun('run-2', {
      project: false,
      result: { status: 'failed', error: 'API Error: 402 A positive credit balance is required' },
    });
    expect(readRunOutcome(dir)).toMatchObject({
      collected: false,
      error: 'API Error: 402 A positive credit balance is required',
    });
  });

  it('reports no reason where the harness recorded none', () => {
    expect(readRunOutcome(writeRun('run-3', { project: false, result: null }))).toMatchObject({
      collected: false,
      error: null,
    });
  });

  it('survives a result.json it cannot parse', () => {
    expect(readRunOutcome(writeRun('run-4', { project: false, result: '{' }))).toMatchObject({
      collected: false,
      error: null,
    });
  });

  // An agent that ran and failed its eval is a result, not a gap: the tree it
  // left behind is exactly what the analysis is there to measure.
  it('counts a run whose eval failed, since it still produced a tree', () => {
    expect(readRunOutcome(writeRun('run-5', { result: { status: 'failed' } }))).toMatchObject({
      collected: true,
    });
  });
});

describe('readRunOutcomes', () => {
  it('reads every run directory, in run order, ignoring everything else', () => {
    writeRun('run-2');
    writeRun('run-10', { project: false, result: { status: 'failed', error: 'boom' } });
    writeRun('run-1');
    writeFileSync(join(root, 'summary.json'), '{}');

    expect(readRunOutcomes(root).map((outcome) => [outcome.run, outcome.collected])).toEqual([
      [1, true],
      [2, true],
      [10, false],
    ]);
  });

  it('reads an eval directory that does not exist as holding nothing', () => {
    expect(readRunOutcomes(join(root, 'nowhere'))).toEqual([]);
  });
});

describe('deleteRunDirs', () => {
  /** results/<experiment>/<timestamp>/<eval>/run-N, as the harness lays it out. */
  function tree(): { results: string; evalDir: string } {
    const evalDir = join(root, 'results', 'arm', '2026-08-17T10-49-58.347Z', '706');
    mkdirSync(evalDir, { recursive: true });
    writeFileSync(join(evalDir, 'summary.json'), '{"totalRuns":2}');
    for (const run of ['run-1', 'run-2']) {
      mkdirSync(join(evalDir, run, 'project'), { recursive: true });
      writeFileSync(join(evalDir, run, 'result.json'), '{"status":"passed"}');
    }
    return { results: join(root, 'results'), evalDir };
  }

  it('deletes the runs it is given and leaves the rest alone', () => {
    const { results, evalDir } = tree();
    expect(deleteRunDirs([join(evalDir, 'run-1')], results)).toMatchObject({ runs: 1 });
    expect(existsSync(join(evalDir, 'run-1'))).toBe(false);
    expect(existsSync(join(evalDir, 'run-2'))).toBe(true);
    expect(existsSync(join(evalDir, 'summary.json'))).toBe(true);
  });

  // summary.json describes runs that are no longer there, so it goes with them
  // rather than being left to claim a sample nobody can read.
  it('removes an eval directory whose last run it deleted, summary and all', () => {
    const { results, evalDir } = tree();
    deleteRunDirs([join(evalDir, 'run-1'), join(evalDir, 'run-2')], results);
    expect(existsSync(evalDir)).toBe(false);
  });

  it('removes the result and experiment directories that leaves empty', () => {
    const { results, evalDir } = tree();
    deleteRunDirs([join(evalDir, 'run-1'), join(evalDir, 'run-2')], results);
    expect(existsSync(join(results, 'arm'))).toBe(false);
    // Never the boundary itself: results/ is where the tree lives.
    expect(existsSync(results)).toBe(true);
  });

  it('keeps a result directory that still holds another eval', () => {
    const { results, evalDir } = tree();
    const sibling = join(evalDir, '..', '701');
    mkdirSync(join(sibling, 'run-1'), { recursive: true });

    deleteRunDirs([join(evalDir, 'run-1'), join(evalDir, 'run-2')], results);
    expect(existsSync(evalDir)).toBe(false);
    expect(existsSync(join(sibling, 'run-1'))).toBe(true);
  });
});

// What went wrong decides what to do about it: a billing stop is re-collected
// as soon as the account is topped up, an eval timeout may mean the timeout is
// too short, and an unreachable endpoint is worth checking before spending
// again on the same arm.
describe('classifyRunError', () => {
  it('names a run stopped by the gateway refusing to bill', () => {
    expect(
      classifyRunError(
        'API Error: 402 A positive credit balance is required for all requests, including BYOK'
      )
    ).toBe('billing');
  });

  it('names a run the harness gave up waiting for', () => {
    expect(classifyRunError('Eval timed out after 1800s')).toBe('timeout');
  });

  it('names a run that could not reach something it needed', () => {
    expect(classifyRunError('fetch failed')).toBe('network');
    expect(classifyRunError('registerExternalStorybookMcp: https://x/mcp is unreachable')).toBe(
      'network'
    );
  });

  it('falls back to a generic kind, and says when nothing was recorded', () => {
    expect(classifyRunError('Docker daemon exploded')).toBe('other');
    expect(classifyRunError(null)).toBe('unrecorded');
  });
});

describe('countCollectedRuns', () => {
  // The number a plan tops a cell up against: counting the failures would leave
  // the cell short of the sample it thinks it has.
  it('counts only the runs that produced a tree', () => {
    writeRun('run-1');
    writeRun('run-2', { project: false, result: { status: 'failed', error: 'boom' } });
    writeRun('run-3');

    expect(countCollectedRuns(root)).toBe(2);
  });
});
