import { isAbsolute, resolve } from 'node:path';

import { inspectCwdOrBin } from '../../common/utils/cwd-or-bin.ts';

/**
 * Resolve the config directory of the Storybook a CLI invocation targets: `--config-dir` when
 * given (relative paths resolve from the target project directory), `.storybook` under it
 * otherwise. A `--cwd` that points at a Storybook bin uses `process.cwd()` as the project
 * directory for those defaults.
 */
export function resolveStorybookConfigDir({
  cwd,
  configDir,
}: { cwd?: string; configDir?: string } = {}) {
  const rawCwd = resolve(cwd ?? process.cwd());
  const projectCwd = inspectCwdOrBin(rawCwd).kind === 'file' ? process.cwd() : rawCwd;
  if (configDir) {
    return isAbsolute(configDir) ? configDir : resolve(projectCwd, configDir);
  }
  return resolve(projectCwd, '.storybook');
}
