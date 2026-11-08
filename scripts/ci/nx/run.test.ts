import { createProjectGraphAsync } from 'nx/src/project-graph/project-graph.js';
import { describe, expect, it } from 'vitest';

import { workflows } from '../utils/types.ts';
import { projectPattern } from './plan.ts';
import { cliWorkspace, commandFor, workspaceOf } from './run.ts';

describe('the NX command of a run', () => {
  const group = { targets: ['check', 'sandbox'], projects: 'tag:library,tag:ci:normal' };

  it('runs every task of the group outside a pull request', () => {
    expect(commandFor(group, undefined)).toEqual([
      'nx',
      'run-many',
      '--targets=check,sandbox',
      '--projects=tag:library,tag:ci:normal',
      '--configuration=production',
    ]);
  });

  it('runs only what a change reaches on a pull request, excluding every other project', () => {
    expect(commandFor(group, 'abc123')).toEqual([
      'nx',
      'affected',
      '--targets=check,sandbox',
      '--exclude=*,!tag:library,!tag:ci:normal',
      '--base=abc123',
      '--head=HEAD',
      '--configuration=production',
    ]);
  });
});

// The setup job (select.ts) makes the run's commands from a project graph it builds in-process,
// which nx-main then runs through the Nx CLI.
it('reads the same targets and project patterns from an in-process project graph as from the Nx CLI', async () => {
  const cli = cliWorkspace();
  const inProcess = workspaceOf(await createProjectGraphAsync({ exitOnError: false }));
  const sorted = (workspace: typeof cli) =>
    Object.fromEntries(
      [...workspace.targetsByProject].map(([project, targets]) => [project, [...targets].sort()])
    );
  expect(sorted(inProcess)).toEqual(sorted(cli));
  for (const pattern of [projectPattern(workflows), ...workflows.map((w) => projectPattern([w]))]) {
    expect(inProcess.matching(pattern).sort()).toEqual(cli.matching(pattern).sort());
  }
}, 120_000);
