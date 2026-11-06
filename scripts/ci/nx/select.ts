// Which tasks a run of the NX DTE pipeline will run, for CircleCI's setup job (.circleci/config.yml),
// which passes them to main.ts so it can size the agent jobs (circleci-dte.ts).
//
// Usage: select.ts --workflow=<workflows> --base-ref=<ref> [--base=<sha>] --out=<file>
//
// With `--base` (NX_BASE from the `nx/set-shas` orb command, on a pull request), the run covers
// only what a change since that commit reaches (`nx affected`); the file records it as `base`.
// `--base-ref` is what a focused run diffs against. Runs after `yarn install`.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { parseArgs } from 'node:util';

import { join } from 'pathe';

import { ROOT_DIRECTORY } from '../../utils/constants.ts';
import { getChangedFiles } from '../focus.ts';
import { parseWorkflows, planFor, windowsTasksOf } from './plan.ts';
import { EMPTY_SELECTION, type Selection } from './selection.ts';

export type SetupSelection = { base?: string; linux: Selection; windows: Selection };

const { values } = parseArgs({
  options: {
    workflow: { type: 'string' },
    'base-ref': { type: 'string', default: 'origin/next' },
    base: { type: 'string' },
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

// A `windows` run's Linux tasks only feed CircleCI's own Windows jobs (circleci-dte.ts).
const linuxRuns =
  !selected.every((workflow) => workflow === 'windows') &&
  (plan.tasks.length > 0 || plan.affectedCheck);
const output: SetupSelection = {
  ...(base ? { base } : {}),
  linux: linuxRuns ? select('linux') : EMPTY_SELECTION,
  windows: windowsTasksOf(plan).length > 0 ? select('windows') : EMPTY_SELECTION,
};
writeFileSync(values.out, JSON.stringify(output));
console.log(
  `${base ? `Affected since ${base}` : 'Everything'}: ${Object.keys(output.linux.tasks).length} Linux and ${Object.keys(output.windows.tasks).length} Windows tasks.`
);
