import { createFixFiles } from '../fix-files.ts';
import {
  type FileFailure,
  applies,
  appliesAfterDetection,
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
  if (result === null || !fix.transform) {
    return result;
  }
  const project = options as ProjectOptions;
  const detected = await runTransforms(project, pluginsFor([{ fix, result }], project), {
    write: false,
  });
  return appliesAfterDetection(fix, detected.get(fix.id)) ? result : null;
};

/**
 * Apply a fix's hooks, then run it and commit its file edits, as the automigration runner does.
 * Resolves with the files the hooks could not transform.
 */
export const runFix = async <Result>(
  fix: Fix<Result>,
  options: Omit<RunOptions<Result>, 'files'>
): Promise<FileFailure[]> => {
  const applied = await runTransforms(
    options,
    pluginsFor([{ fix, result: options.result }], options),
    {
      write: true,
    }
  );
  if (fix.run) {
    const { files, commit } = createFixFiles();
    await fix.run({ ...options, files });
    await commit();
  }
  return applied.get(fix.id)?.errors ?? [];
};
