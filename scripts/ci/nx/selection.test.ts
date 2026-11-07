import { describe, expect, it } from 'vitest';

import type { History } from './nx-cloud-history.ts';
import { type NxTaskGraph, UNKNOWN_TASK_SECONDS, mergeTaskGraphs, weigh } from './selection.ts';

const task = (project: string, target: string, continuous = false, cache = true) => ({
  target: { project, target },
  continuous,
  cache,
});

// As `nx run-many -t e2e-tests-dev-1 --graph=<file>` writes it in Nx 24, edges as `{ id }`.
const devE2eGraph: NxTaskGraph = {
  tasks: {
    'publish:publish': task('publish', 'publish'),
    'scripts:run-registry': task('scripts', 'run-registry', true),
    'a:sandbox': task('a', 'sandbox'),
    'a:dev': task('a', 'dev', true),
    'a:e2e-tests-dev-1': task('a', 'e2e-tests-dev-1'),
    'a:chromatic': task('a', 'chromatic', false, false),
  },
  dependencies: {
    'a:sandbox': [],
    'a:e2e-tests-dev-1': [],
    'a:chromatic': [{ id: 'a:sandbox' }],
    'scripts:run-registry': [{ id: 'publish:publish' }],
  },
  continuousDependencies: {
    'a:e2e-tests-dev-1': [{ id: 'a:dev' }],
    'a:dev': [{ id: 'scripts:run-registry' }],
  },
};

describe('the selection of an NX DTE run', () => {
  it('keeps the tasks of every command, without the continuous ones', () => {
    const selection = mergeTaskGraphs([
      devE2eGraph,
      { tasks: { 'a:sandbox': task('a', 'sandbox'), 'b:check': task('b', 'check') } },
    ]);

    expect(Object.keys(selection.tasks)).toEqual([
      'a:chromatic',
      'a:e2e-tests-dev-1',
      'a:sandbox',
      'b:check',
      'publish:publish',
    ]);
    expect(selection.tasks['b:check']).toEqual({
      project: 'b',
      target: 'check',
      cache: true,
      dependsOn: [],
    });
  });

  it('keeps what each task waits for, through the continuous tasks it needs', () => {
    const { tasks } = mergeTaskGraphs([devE2eGraph]);

    expect(tasks['a:chromatic']).toMatchObject({ cache: false, dependsOn: ['a:sandbox'] });
    expect(tasks['a:e2e-tests-dev-1'].dependsOn).toEqual(['publish:publish']);
  });
});

describe('weighing the selected tasks', () => {
  const history: History = {
    runs: 1,
    succeeded: new Set(['h-sandbox']),
    seen: new Set(['h-sandbox', 'h-e2e']),
    seconds: new Map([
      ['a:e2e-tests-dev-1', 200],
      ['a:chromatic', 12],
    ]),
  };
  const durations = new Map([
    ['a:sandbox', { missSeconds: 120 }],
    ['a:e2e-tests-dev-1', { missSeconds: 300 }],
    ['a:chromatic', { missSeconds: 90 }],
  ]);
  const hashes = {
    'a:sandbox': 'h-sandbox',
    'a:e2e-tests-dev-1': 'h-e2e',
    'a:chromatic': 'h-sandbox',
  };

  it('takes no agent time for a task an earlier run succeeded with', () => {
    const selection = mergeTaskGraphs([devE2eGraph]);
    weigh(selection, hashes, history, durations);

    expect(selection.tasks['a:sandbox']).toMatchObject({ cached: true, seconds: 0 });
  });

  it("runs a task Nx may not restore for NX Cloud's average, not its last quick rerun", () => {
    const selection = mergeTaskGraphs([devE2eGraph]);
    weigh(selection, hashes, history, durations);

    expect(selection.tasks['a:chromatic']).toMatchObject({ cached: false, seconds: 90 });
  });

  it("prefers the pull request's own time for a task over NX Cloud's average", () => {
    const selection = mergeTaskGraphs([devE2eGraph]);
    weigh(selection, hashes, history, durations);

    expect(selection.tasks['a:e2e-tests-dev-1']).toMatchObject({ cached: false, seconds: 200 });
  });

  it('counts every task as one that runs without NX Cloud', () => {
    const selection = mergeTaskGraphs([devE2eGraph]);
    weigh(selection, {}, undefined, undefined);

    expect(Object.values(selection.tasks).map((t) => [t.cached, t.seconds])).toEqual(
      Object.values(selection.tasks).map(() => [false, UNKNOWN_TASK_SECONDS])
    );
  });
});
