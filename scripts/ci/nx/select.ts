// The work a run of the NX DTE pipeline has, for CircleCI's setup job (.circleci/config.yml), which
// passes it to main.ts to generate the jobs (circleci-dte.ts).
//
// Usage: select.ts --workflow=<workflows> --base-ref=<ref> [--base=<sha>] [--nx-branch=<branch>]
//                  [--max-agents=<n>] --out=<file>
//
// - With `--base` (NX_BASE, the merge base on a pull request: from merge-base.sh, or for a focused
//   run from the `nx/set-shas` orb command), the run covers only what a change since that commit
//   reaches (`nx affected`); the file records it as `base`. `--base-ref` is what a focused run
//   diffs against.
// - Each task gets its hash, whether the latest NX Cloud runs on `--nx-branch` (NX_BRANCH, the pull
//   request's number) or on the branch of `--base-ref` already stored it, and how long it takes
//   (nx-cloud-history.ts).
// - From that, `agents` holds how many agents each OS starts (agent-sizing.ts), Linux at most
//   `--max-agents`.
//
// Runs after `yarn install`.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { parseArgs } from 'node:util';

import { createProjectGraphAsync } from 'nx/src/project-graph/project-graph.js';
import { join } from 'pathe';

import { ROOT_DIRECTORY } from '../../utils/constants.ts';
import { changedFilesEnvironment, focusDiff } from '../utils/changed-files.ts';
import { AGENT_BOOT_SECONDS, MAX_AGENTS, agentsFor } from './agent-sizing.ts';
import { baseRuns, osHistory, taskDurations } from './nx-cloud-history.ts';
import { linuxRuns, parseWorkflows, planFor, windowsTasksOf } from './plan.ts';
import { nxCommands, workspaceOf } from './run.ts';
import {
  EMPTY_SELECTION,
  type NxTaskGraph,
  type Selection,
  mergeTaskGraphs,
  weigh,
  workOf,
} from './selection.ts';
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
const diff = selected.includes('focus') ? focusDiff(values['base-ref']) : undefined;
const plan = planFor(selected, diff?.files ?? []);
const base = values.base || undefined;
const branch = values['nx-branch'] || undefined;
const max = {
  linux: Number(values['max-agents'] || MAX_AGENTS.linux),
  windows: MAX_AGENTS.windows,
};

// Built once, in-process, for both OSes: the commands (run.ts `nxCommands`) and the hashes
// (task-hashes.ts) come from it. Only the task graphs of the commands come from the Nx CLI, which
// nx-main runs them with. A project graph Nx cannot build fails the job, as `nx affected` would.
const projectGraph = createProjectGraphAsync({ exitOnError: false });
const workspace = projectGraph.then(workspaceOf);

const directory = mkdtempSync(join(tmpdir(), 'nx-selection-'));
// The tasks `command` runs, from `nx … --graph=<file>`.
const taskGraph = (command: string[], file: string) =>
  new Promise<NxTaskGraph>((resolve, reject) => {
    let stderr = '';
    const child = spawn('yarn', [...command, `--graph=${file}`], {
      cwd: ROOT_DIRECTORY,
      stdio: ['ignore', 'ignore', 'pipe'],
      env: { ...process.env, ...changedFilesEnvironment(diff) },
    });
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('close', (code) =>
      code === 0
        ? resolve(JSON.parse(readFileSync(file, 'utf8')).tasks)
        : reject(new Error(`yarn ${command.join(' ')} --graph=${file} failed:\n${stderr}`))
    );
  });
const select = async (os: Os): Promise<Selection> => {
  const commands = nxCommands({
    selected,
    env: os,
    base,
    changedFiles: diff?.files ?? [],
    workspace: await workspace,
  });
  const graphs = await Promise.all(
    commands.map((command, i) => taskGraph(command, join(directory, `${os}-${i}.json`)))
  );
  return { ...mergeTaskGraphs(graphs), commands };
};

const runsOn = { linux: linuxRuns(selected, plan), windows: windowsTasksOf(plan).length > 0 };
const baseBranchRuns =
  runsOn.linux || runsOn.windows
    ? baseRuns(values['base-ref'].replace(/^origin\//, ''))
    : Promise.resolve([]);
const history = (os: Os) => (runsOn[os] ? osHistory(os, branch, baseBranchRuns) : undefined);
// NX Cloud answers while Nx selects the tasks.
const [, linux, windows, linuxHistory, windowsHistory, durations] = await Promise.all([
  workspace,
  runsOn.linux ? select('linux') : EMPTY_SELECTION,
  runsOn.windows ? select('windows') : EMPTY_SELECTION,
  history('linux'),
  history('windows'),
  taskDurations(),
]);
console.log(
  `${base ? `Affected since ${base}` : 'Everything'}: ${Object.keys(linux.tasks).length} Linux and ${Object.keys(windows.tasks).length} Windows tasks.`
);

const hashes = await hashSelections({ linux, windows }, await projectGraph).catch((error) => {
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
      past?.runs ? `(${past.runs} earlier runs knew ${seen} of the hashes)` : '(no earlier runs)',
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
