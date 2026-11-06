// Which tasks a run of the NX DTE pipeline will run, for CircleCI's setup job (.circleci/config.yml),
// which passes them to main.ts so it can size the agent jobs (circleci-dte.ts).
//
// Usage: select.ts --workflow=<workflows> --base-ref=<ref> [--base=<sha>]
//                  [--nx-branch=<branch>] [--base-branch=<branch>] --out=<file>
//
// With `--base` (NX_BASE from the `nx/set-shas` orb command, on a pull request), the run covers
// only what a change since that commit reaches (`nx affected`); the file records it as `base`.
// `--base-ref` is what a focused run diffs against. Runs after `yarn install`.
//
// Each task also gets its hash, whether NX Cloud already has it in the cache from the latest runs
// on `--nx-branch` (the branch NX Cloud records, NX_BRANCH) and `--base-branch`, and how long it
// takes (nx-cloud-history.ts), so main.ts starts only the agents the uncached work needs.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { parseArgs } from 'node:util';

import { join } from 'pathe';

import { ROOT_DIRECTORY } from '../../utils/constants.ts';
import { getChangedFiles } from '../focus.ts';
import { agentsFor } from './agent-sizing.ts';
import { AGENT_BOOT_SECONDS, MAX_AGENTS } from './circleci-dte.ts';
import { type Durations, cachedHashes, taskDurations } from './nx-cloud-history.ts';
import { linuxRuns, parseWorkflows, planFor, windowsTasksOf } from './plan.ts';
import {
  CACHE_HIT_SECONDS,
  EMPTY_SELECTION,
  type Selection,
  UNKNOWN_TASK_SECONDS,
  workOf,
} from './selection.ts';
import { hashSelection } from './task-hashes.ts';

export type SetupSelection = { base?: string; linux: Selection; windows: Selection };

const { values } = parseArgs({
  options: {
    workflow: { type: 'string' },
    'base-ref': { type: 'string', default: 'origin/next' },
    base: { type: 'string' },
    'nx-branch': { type: 'string' },
    'base-branch': { type: 'string' },
    out: { type: 'string' },
  },
});
if (!values.out) {
  throw new Error(
    'Usage: select.ts --workflow=<workflows> --base-ref=<ref> [--base=<sha>] --out=<file>'
  );
}

const selected = parseWorkflows(values.workflow ?? '');
const changedFiles = selected.includes('focus') ? getChangedFiles(values['base-ref']) : [];
const plan = planFor(selected, changedFiles);
const base = values.base || undefined;

const directory = mkdtempSync(join(tmpdir(), 'nx-selection-'));
const select = (env: 'linux' | 'windows'): Selection => {
  const file = join(directory, `${env}.json`);
  const result = spawnSync(
    'yarn',
    [
      'exec',
      'jiti',
      './scripts/ci/nx/run.ts',
      `--workflow=${selected.join(',')}`,
      `--env=${env}`,
      ...(base ? [`--base=${base}`] : []),
      `--graph=${file}`,
    ],
    {
      cwd: ROOT_DIRECTORY,
      stdio: 'inherit',
      env: {
        ...process.env,
        CI_CHANGED_FILES: changedFiles.join('\n'),
        CI_CHANGED_FILES_COUNT: `${changedFiles.length}`,
      },
    }
  );
  if (result.status !== 0) {
    throw new Error(`Selecting the ${env} tasks failed.`);
  }
  return JSON.parse(readFileSync(file, 'utf8'));
};

const branches = [values['nx-branch'], values['base-branch']].filter((b): b is string => !!b);
const durations = taskDurations();

// Fills in each task's hash, whether it is cached, and its seconds.
async function weigh(selection: Selection, env: 'linux' | 'windows') {
  const tasks = Object.entries(selection.tasks);
  if (tasks.length === 0) {
    return;
  }
  const [hashes, history, known] = await Promise.all([
    hashSelection(selection, env).catch((error) => {
      console.warn(
        `Hashing the ${env} tasks failed, so every task counts as one that runs: ${error}`
      );
      return {} as Record<string, string>;
    }),
    cachedHashes(branches, env),
    durations,
  ]);
  const secondsOf = (stats: Durations | undefined, key: string, cached: boolean) => {
    const row = stats?.get(key);
    return cached
      ? (row?.hitSeconds ?? CACHE_HIT_SECONDS)
      : (row?.missSeconds ?? UNKNOWN_TASK_SECONDS);
  };
  for (const [id, task] of tasks) {
    task.hash = hashes[id];
    task.cached = task.cache && !!task.hash && !!history?.succeeded.has(task.hash);
    task.seconds = Math.round(secondsOf(known, `${task.project}:${task.target}`, task.cached));
  }

  const cached = tasks.filter(([, task]) => task.cached).length;
  const seen = tasks.filter(([, task]) => task.hash && history?.seen.has(task.hash)).length;
  const minutes = tasks.reduce((sum, [, task]) => sum + task.seconds!, 0) / 60;
  const { agents, seconds } = agentsFor(workOf(selection), {
    max: MAX_AGENTS[env],
    bootSeconds: AGENT_BOOT_SECONDS[env],
  });
  console.log(
    [
      `${env}: ${tasks.length} tasks, ${cached} of them in the cache`,
      history
        ? `(${history.runs} earlier runs on ${branches.join(', ')} knew ${seen} of the hashes)`
        : '(no cache entries from NX Cloud)',
      `→ ${Math.round(minutes)} agent-minutes of work: ${agents} agents, done in about ${Math.round(seconds / 60)} minutes.`,
    ].join(' ')
  );
}

const output: SetupSelection = {
  ...(base ? { base } : {}),
  linux: linuxRuns(selected, plan) ? select('linux') : EMPTY_SELECTION,
  windows: windowsTasksOf(plan).length > 0 ? select('windows') : EMPTY_SELECTION,
};
console.log(
  `${base ? `Affected since ${base}` : 'Everything'}: ${Object.keys(output.linux.tasks).length} Linux and ${Object.keys(output.windows.tasks).length} Windows tasks.`
);
await weigh(output.linux, 'linux');
await weigh(output.windows, 'windows');
writeFileSync(values.out, JSON.stringify(output));
