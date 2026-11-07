// Lint, format-check or unit-test only what a focused run's diff touches, with the checks CircleCI's
// focused jobs run (`affectedLintAndFormatChecks` and `AFFECTED_UNIT_TESTS_COMMAND` in
// scripts/ci/common-jobs.ts).
//
// Usage: affected.ts lint|test. Reads the changed files since `CI_CHANGED_FILES_BASE`, and checks
// them against `CI_CHANGED_FILES_COUNT` (scripts/ci/utils/changed-files.ts).
import { spawnSync } from 'node:child_process';

import { join } from 'pathe';

import { ROOT_DIRECTORY } from '../../utils/constants.ts';
import { esMain } from '../../utils/esmain.ts';
import { AFFECTED_UNIT_TESTS_COMMAND, affectedLintAndFormatChecks } from '../common-jobs.ts';
import { isGlobalInput, isTestFixture } from '../global-inputs.ts';
import { changedFilesFromEnvironment } from '../utils/changed-files.ts';

// The exit status of `command`, run with `files` as its arguments. They go through stdin and xargs:
// one argument or environment variable can hold at most 128 KiB on Linux, and xargs splits a longer
// list over several runs. `env` lets the command start with variable assignments.
export function runOnFiles(command: string, files: readonly string[], cwd = ROOT_DIRECTORY) {
  console.log(`$ ${command} <${files.length} files>`);
  return spawnSync('bash', ['-c', `tr '\\n' '\\0' | xargs -0 env ${command}`], {
    cwd,
    input: files.join('\n'),
    stdio: ['pipe', 'inherit', 'inherit'],
  }).status;
}

function run(command: string, cwd: string) {
  console.log(`$ ${command}`);
  return spawnSync('bash', ['-c', command], { cwd, stdio: 'inherit' }).status;
}

function main(mode: string | undefined) {
  if (process.env.CI_CHANGED_FILES_COUNT === undefined && process.env.CI) {
    throw new Error('CI_CHANGED_FILES_COUNT is not set, so the changed files cannot be trusted.');
  }
  const changedFiles = changedFilesFromEnvironment();

  if (changedFiles.length === 0) {
    console.log('The diff is empty: nothing to check.');
  } else if (mode === 'lint') {
    for (const { dir, command, files } of affectedLintAndFormatChecks(changedFiles)) {
      const cwd = join(ROOT_DIRECTORY, dir ?? '');
      const status = files ? runOnFiles(command, files, cwd) : run(command, cwd);
      if (status !== 0) {
        process.exit(status ?? 1);
      }
    }
  } else if (mode === 'test') {
    // CircleCI runs the whole suite instead when a global input or a test fixture changed; the focus
    // plan then asks for `code:test-1` and `code:test-2` and this task is not part of it.
    if (changedFiles.some((file) => isGlobalInput(file) || isTestFixture(file))) {
      throw new Error(
        'A global input or test fixture changed: run `code:test-1` and `-2` instead.'
      );
    }
    const status = runOnFiles(AFFECTED_UNIT_TESTS_COMMAND, changedFiles);
    if (status !== 0) {
      process.exit(status ?? 1);
    }
  } else {
    throw new Error('Usage: affected.ts lint|test');
  }
}

if (esMain(import.meta.url)) {
  main(process.argv[2]);
}
