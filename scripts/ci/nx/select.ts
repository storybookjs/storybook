// The work a run of the NX DTE pipeline has, for CircleCI's setup job (.circleci/config.yml), which
// passes it to main.ts to generate the jobs (circleci-dte.ts).
//
// Usage: select.ts --workflow=<workflows> --base-ref=<ref> [--base=<sha>] [--nx-branch=<branch>]
//                  [--max-agents=<n>] --out=<file>
//
// - With `--base` (NX_BASE from the `nx/set-shas` orb command, on a pull request), the run covers
//   only what a change since that commit reaches (`nx affected`); the file records it as `base`.
//   `--base-ref` is what a focused run diffs against.
// - Each task gets its hash, whether the latest NX Cloud runs on `--nx-branch` (NX_BRANCH, the pull
//   request's number) already stored it, and how long it takes (nx-cloud-history.ts).
// - From that, `agents` holds how many agents each OS starts (agent-sizing.ts), Linux at most
//   `--max-agents`.
//
// Runs after `yarn install`.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { parseArgs } from 'node:util';

import { join } from 'pathe';

import { ROOT_DIRECTORY } from '../../utils/constants.ts';
import { getChangedFiles } from '../focus.ts';
import { AGENT_BOOT_SECONDS, MAX_AGENTS, agentsFor } from './agent-sizing.ts';
import { branchHistory, taskDurations } from './nx-cloud-history.ts';
import { linuxRuns, parseWorkflows, planFor, windowsTasksOf } from './plan.ts';
import { EMPTY_SELECTION, type Selection, weigh, workOf } from './selection.ts';
import { hashSelections } from './task-hashes.ts';

type Os = 'linux' | 'windows';

export type SetupSelection = {
  base?: string;
  linux: Selection;
  windows: Selection;
  agents: Record<Os, number>;
};

const { values } = parseArgs({
  options: {
    workflow: { type: 'string' },
    'base-ref': { type: 'string', default: 'origin/next' },
    base: { type: 'string' },
    'nx-branch': { type: 'string' },
    'max-agents': { type: 'string' },
    out: { type: 'string' },
  },
});
if (!values.out) {
  throw new Error(
    'Usage: select.ts --workflow=<workflows> --base-ref=<ref> [--base=<sha>] [--nx-branch=<branch>] [--max-agents=<n>] --out=<file>'
  );
}

const selected = parseWorkflows(values.workflow ?? '');
const changedFiles = selected.includes('focus') ? getChangedFiles(values['base-ref']) : [];
const plan = planFor(selected, changedFiles);
const base = values.base || undefined;
const branch = values['nx-branch'] || undefined;
const max = {
  linux: Number(values['max-agents'] || MAX_AGENTS.linux),
  windows: MAX_AGENTS.windows,
};

const directory = mkdtempSync(join(tmpdir(), 'nx-selection-'));
const select = (os: Os): Promise<Selection> => {
  const file = join(directory, `${os}.json`);
  const args = [
    'exec',
    'jiti',
    './scripts/ci/nx/run.ts',
    `--workflow=${selected.join(',')}`,
    `--env=${os}`,
    ...(base ? [`--base=${base}`] : []),
    `--graph=${file}`,
  ];
  return new Promise((resolve, reject) => {
    spawn('yarn', args, {
      cwd: ROOT_DIRECTORY,
      stdio: 'inherit',
      env: {
        ...process.env,
        CI_CHANGED_FILES: changedFiles.join('\n'),
        CI_CHANGED_FILES_COUNT: `${changedFiles.length}`,
      },
    }).on('close', (code) =>
      code === 0
        ? resolve(JSON.parse(readFileSync(file, 'utf8')))
        : reject(new Error(`Selecting the ${os} tasks failed.`))
    );
  });
};

const runsOn = { linux: linuxRuns(selected, plan), windows: windowsTasksOf(plan).length > 0 };
const history = (os: Os) => (runsOn[os] && branch ? branchHistory(branch, os) : undefined);
// NX Cloud answers while Nx selects the tasks.
const [linux, windows, linuxHistory, windowsHistory, durations] = await Promise.all([
  runsOn.linux ? select('linux') : EMPTY_SELECTION,
  runsOn.windows ? select('windows') : EMPTY_SELECTION,
  history('linux'),
  history('windows'),
  taskDurations(),
]);
console.log(
  `${base ? `Affected since ${base}` : 'Everything'}: ${Object.keys(linux.tasks).length} Linux and ${Object.keys(windows.tasks).length} Windows tasks.`
);

const hashes = await hashSelections({ linux, windows }).catch((error) => {
  console.warn(`Hashing the tasks failed, so every task counts as one that runs: ${error}`);
  return { linux: {}, windows: {} };
});

const size = (os: Os, selection: Selection, past: typeof linuxHistory) => {
  const tasks = Object.values(selection.tasks);
  if (tasks.length === 0) {
    return 0;
  }
  weigh(selection, hashes[os], past, durations);
  const cached = tasks.filter((task) => task.cached).length;
  const seen = tasks.filter((task) => task.hash && past?.seen.has(task.hash)).length;
  if (past && past.runs > 0 && seen === 0) {
    console.warn(
      `WARNING: ${past.runs} earlier ${os} runs on ${branch} know none of the ${tasks.length} hashes. The setup job hashes differently from Nx in the run (task-hashes.ts), so every task counts as one that runs.`
    );
  }
  const work = tasks.reduce((sum, task) => sum + task.seconds!, 0) / 60;
  const { agents, seconds } = agentsFor(workOf(selection), {
    max: max[os],
    bootSeconds: AGENT_BOOT_SECONDS[os],
  });
  console.log(
    [
      `${os}: ${tasks.length} tasks, ${cached} of them in the cache`,
      past ? `(${past.runs} earlier runs knew ${seen} of the hashes)` : '(no earlier runs)',
      `→ ${Math.round(work)} minutes of work: ${agents} agents, done in about ${Math.round(seconds / 60)} minutes.`,
    ].join(' ')
  );
  return agents;
};

const output: SetupSelection = {
  ...(base ? { base } : {}),
  linux,
  windows,
  agents: {
    linux: size('linux', linux, linuxHistory),
    windows: size('windows', windows, windowsHistory),
  },
};
writeFileSync(values.out, JSON.stringify(output));
