/**
 * Lint, format-check or unit-test only what a focused run's diff touches, with the steps CircleCI's
 * focused jobs run (`affectedLintAndFormatSteps` and `AFFECTED_UNIT_TESTS_COMMAND` in
 * scripts/ci/common-jobs.ts).
 *
 * Usage: affected.ts lint|test. Reads the changed files, one per line, from `CI_CHANGED_FILES`,
 * and their count from `CI_CHANGED_FILES_COUNT`, which nx.yml sets on the main job and forwards to
 * the NX Cloud workers.
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import { ROOT_DIRECTORY } from '../../utils/constants.ts';
import { AFFECTED_UNIT_TESTS_COMMAND, affectedLintAndFormatSteps } from '../common-jobs.ts';
import { isGlobalInput, isTestFixture } from '../global-inputs.ts';

const mode = process.argv[2];
const changedFiles = (process.env.CI_CHANGED_FILES ?? '').split('\n').filter(Boolean);

function sh(command: string, cwd = ROOT_DIRECTORY, env: Record<string, unknown> = {}) {
  console.log(`$ ${command}`);
  const { status } = spawnSync('bash', ['-c', command], {
    cwd,
    env: {
      ...process.env,
      ...Object.fromEntries(Object.entries(env).map(([k, v]) => [k, `${v}`])),
    },
    stdio: 'inherit',
  });
  if (status !== 0) {
    process.exit(status ?? 1);
  }
}

const expected = process.env.CI_CHANGED_FILES_COUNT;
if (expected === undefined && process.env.CI) {
  throw new Error('CI_CHANGED_FILES_COUNT is not set, so the changed files cannot be trusted.');
}
if (expected !== undefined && Number(expected) !== changedFiles.length) {
  throw new Error(
    `CI_CHANGED_FILES lists ${changedFiles.length} files, but the main job found ${expected}.`
  );
}

if (changedFiles.length === 0) {
  console.log('The diff is empty: nothing to check.');
} else if (mode === 'lint') {
  for (const { run } of affectedLintAndFormatSteps(changedFiles)) {
    const { working_directory, environment, command } = run as {
      working_directory?: string;
      environment?: Record<string, unknown>;
      command: string;
    };
    sh(command, join(ROOT_DIRECTORY, working_directory ?? ''), environment);
  }
} else if (mode === 'test') {
  // CircleCI runs the whole suite instead when a global input or a test fixture changed; the focus
  // plan then asks for `code:test` and this task is not part of it.
  if (changedFiles.some((file) => isGlobalInput(file) || isTestFixture(file))) {
    throw new Error('A global input or test fixture changed: run `code:test` instead.');
  }
  sh(`${AFFECTED_UNIT_TESTS_COMMAND} ${changedFiles.map((file) => `'${file}'`).join(' ')}`);
} else {
  throw new Error('Usage: affected.ts lint|test');
}
