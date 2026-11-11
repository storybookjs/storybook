import { createFixFiles } from '../fix-files.ts';
import { type FileFailure, applies, applyFixes, detectApplicable } from '../pipeline.ts';
import type { CheckOptions, Fix, RunOptions } from '../types.ts';

type ProjectOptions = Omit<CheckOptions, 'files'> & {
  configDir: string;
  mainConfigPath: string;
};

/** Run a fix's `check` and the detection pass of its hooks, as the automigration runner does. */
export const checkFix = async <Result>(
  fix: Fix<Result>,
  options: Omit<CheckOptions, 'files'>
): Promise<Result | null> => {
  const result = (await (fix.check ?? applies)({
    ...options,
    files: createFixFiles().files,
  })) as Result | null;
  if (result === null) {
    return null;
  }
  const applicable = await detectApplicable(options as ProjectOptions, [{ fix, result }]);
  return applicable.length > 0 ? result : null;
};

/**
 * Run a fix the way the automigration runner does: its `run`, the commit, then its hooks. Resolves
 * with the files the hooks could not transform, and rejects when `run` throws.
 */
export const runFix = async <Result>(
  fix: Fix<Result>,
  { result, ...options }: Omit<RunOptions<Result>, 'files'>
): Promise<FileFailure[]> => {
  const outcome = (await applyFixes(options, [{ fix, result }])).get(fix.id)!;
  if (outcome.status === 'skipped') {
    return [];
  }
  if (outcome.status === 'failed' && outcome.fileFailures.length === 0) {
    throw outcome.error;
  }
  return outcome.fileFailures;
};
