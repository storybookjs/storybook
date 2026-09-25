import { createFixFiles } from '../fix-files.ts';
import type { CheckOptions, Fix, RunOptions } from '../types.ts';

/** Run a fix's `check` with scratch file edits, as the automigration runner does. */
export const checkFix = <Result>(fix: Fix<Result>, options: Omit<CheckOptions, 'files'>) =>
  fix.check({ ...options, files: createFixFiles().files });

/** Run a fix and commit its file edits, as the automigration runner does. */
export const runFix = async <Result>(
  fix: Fix<Result>,
  options: Omit<RunOptions<Result>, 'files'>
) => {
  if (!fix.run) {
    throw new Error(`${fix.id} has no run step`);
  }
  const { files, commit } = createFixFiles();
  await fix.run({ ...options, files });
  await commit();
};
