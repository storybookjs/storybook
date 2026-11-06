import { describe, expect, it } from 'vitest';

import {
  type CommitStatus,
  clearedStatuses,
  failureStatuses,
  parseFailedTasks,
  taskFromLogRedirect,
} from './dte-task-statuses.ts';

// Rows in the layout of a real `nx-main` log: CircleCI keeps Nx's colours and CRLF line ends.
const log = [
  '│       ✔ Completed       │ react-vite/default-ts:chromatic:produ… │  2m 4s   │     Cache Miss     │',
  '│                         └────────────────────────────────────────┴──────────┴────────────────────┤',
  '│        \x1b[31m✖ Failed\x1b[39m           code:test-affected:production             1m 6s         Cache Miss     │',
  '│           > Task logs: https://cloud.nx.app/logs/l8mV3r7x0g                                      │',
  '│        ✖ Failed           nextjs-vite/default-ts:e2e-tests-dev-…    3m 2s         Cache Miss     │',
  '│           > Task logs: https://cloud.nx.app/logs/dev1aaaaaa                                      │',
  '│        ✖ Failed           nextjs-vite/default-ts:e2e-tests-dev-…    3m 9s         Cache Miss     │',
  '│           > Task logs: https://cloud.nx.app/logs/dev2bbbbbb                                      │',
  '│        ✖ Failed           bench/react-vite-default-ts-test-buil…    1m 1s         Cache Miss     │',
  '│        ✖ Failed           scripts:check:production                 5s         Cache Miss     │',
  '│           > Task logs: https://cloud.nx.app/logs/checkccccc                                      │',
  '└──────────────────────────────────────────────────────────────────────────────────────────────────┘',
  '│ 4      │ Failed Tasks                           │ 3.70%  │ Failure Percentage                    │',
].join('\r\n');

describe('parseFailedTasks', () => {
  it('reads every failed row, cut-off names included, with the log link on the next line', () => {
    expect(parseFailedTasks(log)).toEqual([
      { task: 'code:test-affected:production', url: 'https://cloud.nx.app/logs/l8mV3r7x0g' },
      {
        task: 'nextjs-vite/default-ts:e2e-tests-dev-…',
        url: 'https://cloud.nx.app/logs/dev1aaaaaa',
      },
      {
        task: 'nextjs-vite/default-ts:e2e-tests-dev-…',
        url: 'https://cloud.nx.app/logs/dev2bbbbbb',
      },
      { task: 'bench/react-vite-default-ts-test-buil…', url: undefined },
      { task: 'scripts:check:production', url: 'https://cloud.nx.app/logs/checkccccc' },
    ]);
  });

  it('reads nothing from a log without failed tasks', () => {
    expect(
      parseFailedTasks('│ ✔ Completed │ core:compile:production │ 0s │ Remote Cache Hit │')
    ).toEqual([]);
  });
});

describe('taskFromLogRedirect', () => {
  it('reads the full task id from the task page a log link redirects to', () => {
    expect(
      taskFromLogRedirect(
        '/runs/oWcpjEDnVw/task/react-vite%2Fdefault-ts%3Ae2e-tests-dev-1%3Aproduction'
      )
    ).toBe('react-vite/default-ts:e2e-tests-dev-1:production');
    expect(taskFromLogRedirect('/login')).toBeUndefined();
    expect(taskFromLogRedirect(null)).toBeUndefined();
  });
});

describe('failureStatuses', () => {
  it('marks each failed task as a failure linked to its log', () => {
    expect(
      failureStatuses(
        [{ task: 'code:test-affected:production', url: 'https://cloud.nx.app/logs/x' }],
        'focus'
      )
    ).toEqual([
      {
        context: 'nx run code:test-affected:production',
        state: 'failure',
        description: 'Failed on the NX agents (nx:focus)',
        target_url: 'https://cloud.nx.app/logs/x',
      },
    ]);
  });
});

describe('clearedStatuses', () => {
  const existing: CommitStatus[] = [
    {
      context: 'nx run core:test:production',
      state: 'failure',
      description: 'Failed on the NX agents (nx:focus)',
      target_url: 'https://cloud.nx.app/logs/a',
    },
    {
      context: 'nx run core:check:production',
      state: 'failure',
      description: 'Failed on the NX agents (nx:normal)',
    },
    {
      context: 'nx run core:lint:production',
      state: 'failure',
      description: 'Your test failed on NX Cloud (nx: focus)',
    },
    {
      context: 'nx run core:compile:production',
      state: 'success',
      description: 'Passed on a later run (nx:focus)',
    },
    { context: 'ci/circleci: nx-main', state: 'failure', description: 'Your tests failed' },
  ];

  it('turns green only the task failures a run of the same workflows left', () => {
    expect(clearedStatuses(existing, 'focus')).toEqual([
      {
        context: 'nx run core:test:production',
        state: 'success',
        description: 'Passed on a later run (nx:focus)',
        target_url: 'https://cloud.nx.app/logs/a',
      },
    ]);
  });
});
