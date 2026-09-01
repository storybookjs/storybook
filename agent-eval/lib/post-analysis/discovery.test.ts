import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { findRuns, selectRuns } from './discovery.ts';

let root: string;

/** results/<experiment>/<model>/<timestamp>/<eval>/run-N/project */
function run(experiment: string, timestamp: string, evalName: string, index: number): void {
  const dir = join(root, experiment, 'opus', timestamp, evalName, `run-${index}`, 'project');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.ts'), '');
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'discovery-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('findRuns', () => {
  it('reads experiment, timestamp, eval and index out of the layout', () => {
    run('arm-a', '2026-07-27T10-43-55.864Z', '701-new-ui-flow', 1);
    expect(findRuns(root)).toEqual([
      {
        runDir: join(root, 'arm-a/opus/2026-07-27T10-43-55.864Z/701-new-ui-flow/run-1'),
        projectDir: join(root, 'arm-a/opus/2026-07-27T10-43-55.864Z/701-new-ui-flow/run-1/project'),
        experiment: 'arm-a',
        model: 'opus',
        timestamp: '2026-07-27T10-43-55.864Z',
        evalName: '701-new-ui-flow',
        run: 1,
        collected: true,
      },
    ]);
  });

  it('returns nothing for a missing results directory', () => {
    expect(findRuns(join(root, 'absent'))).toEqual([]);
  });

  // A run-N directory with no collected project is still a run — the judge
  // CLI reports it as unjudgeable rather than silently skipping it — but it
  // is flagged, so consumers that need a tree can filter on `collected`.
  it('flags a run directory with no project as uncollected', () => {
    mkdirSync(join(root, 'arm-a/opus/2026-07-27T10-43-55.864Z/701/run-1'), { recursive: true });
    expect(findRuns(root)).toEqual([
      {
        runDir: join(root, 'arm-a/opus/2026-07-27T10-43-55.864Z/701/run-1'),
        projectDir: join(root, 'arm-a/opus/2026-07-27T10-43-55.864Z/701/run-1/project'),
        experiment: 'arm-a',
        model: 'opus',
        timestamp: '2026-07-27T10-43-55.864Z',
        evalName: '701',
        run: 1,
        collected: false,
      },
    ]);
  });
});

describe('selectRuns', () => {
  function threeRuns() {
    run('arm-a', '2026-07-01T00-00-00.000Z', '701', 1);
    run('arm-a', '2026-08-01T00-00-00.000Z', '701', 1);
    run('arm-b', '2026-07-01T00-00-00.000Z', '701', 1);
    return findRuns(root);
  }

  it('filters by experiment', () => {
    const selected = selectRuns(threeRuns(), {
      experiments: ['arm-b'],
      evals: [],
      since: null,
      latest: false,
    });
    expect(selected.map((entry) => entry.experiment)).toEqual(['arm-b']);
  });

  it('filters by eval', () => {
    const selected = selectRuns(threeRuns(), {
      experiments: [],
      evals: ['701'],
      since: null,
      latest: false,
    });
    expect(selected.map((entry) => entry.evalName)).toEqual(['701', '701', '701']);
  });

  it('filters by date, parsing the dashed-time directory format', () => {
    const selected = selectRuns(threeRuns(), {
      experiments: [],
      evals: [],
      since: '2026-07-15',
      latest: false,
    });
    expect(selected.map((entry) => entry.timestamp)).toEqual(['2026-08-01T00-00-00.000Z']);
  });

  it('keeps only the newest timestamp per experiment when latest is set', () => {
    const selected = selectRuns(threeRuns(), {
      experiments: [],
      evals: [],
      since: null,
      latest: true,
    });
    expect(selected.map((entry) => `${entry.experiment}@${entry.timestamp}`).sort()).toEqual([
      'arm-a@2026-08-01T00-00-00.000Z',
      'arm-b@2026-07-01T00-00-00.000Z',
    ]);
  });

  it('rejects an unparseable since date rather than filtering everything out', () => {
    expect(() =>
      selectRuns(threeRuns(), {
        experiments: [],
        evals: [],
        since: 'not-a-date',
        latest: false,
      })
    ).toThrow(/parseable date/);
  });
});
