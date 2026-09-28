import { createFixFiles } from '../fix-files.ts';
import {
  type FileFailure,
  applies,
  detectApplicable,
  pluginsFor,
  runTransforms,
} from '../pipeline.ts';
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
 * Run a fix, commit its file edits, then apply its hooks, as the automigration runner does. Resolves
 * with the files the hooks could not transform; a declined `run` applies nothing.
 */
export const runFix = async <Result>(
  fix: Fix<Result>,
  options: Omit<RunOptions<Result>, 'files'>
): Promise<FileFailure[]> => {
  if (fix.run) {
    const { files, commit } = createFixFiles();
    if ((await fix.run({ ...options, files })) === false) {
      return [];
    }
    await commit();
  }
  const applied = await runTransforms(
    options,
    pluginsFor([{ fix, result: options.result }], options),
    { write: true }
  );
  return applied.get(fix.id)?.errors ?? [];
};
