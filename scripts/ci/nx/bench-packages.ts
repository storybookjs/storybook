// Benchmark the published package sizes, as CircleCI's `Benchmark packages` job does
// (scripts/ci/common-jobs.ts). The local registry must be running.
//
// Comparing against the base branch and uploading the results both need `GCP_CREDENTIALS`. Without
// it, the packages are still installed and measured, so a broken package still fails the task.
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter } from 'node:path';

import { join } from 'pathe';

import { ROOT_DIRECTORY } from '../../utils/constants.ts';
import { BEFORE_SANDBOX_NPM_MIN_VERSION } from '../../utils/npm-constants.ts';

function run(command: string, args: string[], env: NodeJS.ProcessEnv, cwd = ROOT_DIRECTORY) {
  console.log(`$ ${command} ${args.join(' ')}`);
  const { status } = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
  if (status !== 0) {
    process.exit(status ?? 1);
  }
}

// CircleCI installs this npm globally with sudo. A private prefix leaves the worker's npm alone for
// the other tasks it runs.
const prefix = mkdtempSync(join(tmpdir(), 'npm-'));
run(
  'npm',
  ['install', '--global', '--prefix', prefix, `npm@${BEFORE_SANDBOX_NPM_MIN_VERSION}`],
  process.env
);

const { GCP_CREDENTIALS, BENCH_BASE_BRANCH, BENCH_PR_NUMBER, CI_HEAD_BRANCH, CI_HEAD_SHA } =
  process.env;

const args = GCP_CREDENTIALS
  ? [
      '--upload',
      ...(BENCH_BASE_BRANCH ? ['--base-branch', BENCH_BASE_BRANCH] : []),
      ...(BENCH_PR_NUMBER ? ['--pull-request', BENCH_PR_NUMBER] : []),
    ]
  : [];

if (!GCP_CREDENTIALS) {
  console.log('GCP_CREDENTIALS is not set: measuring only, without comparing or uploading.');
}

run(
  'yarn',
  ['bench-packages', ...args],
  {
    ...process.env,
    PATH: [join(prefix, 'bin'), process.env.PATH].join(delimiter),
    // bench-packages reads the branch and commit it uploads from CircleCI's variables.
    ...(CI_HEAD_BRANCH ? { CIRCLE_BRANCH: CI_HEAD_BRANCH } : {}),
    ...(CI_HEAD_SHA ? { CIRCLE_SHA1: CI_HEAD_SHA } : {}),
  },
  join(ROOT_DIRECTORY, 'scripts')
);
