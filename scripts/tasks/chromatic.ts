import { existsSync } from 'node:fs';

import { dirname, join } from 'pathe';

import type { Task } from '../task.ts';
import { ROOT_DIRECTORY } from '../utils/constants.ts';
import { exec } from '../utils/exec.ts';
import { isNxTaskExecution } from '../utils/nx.ts';

export const chromatic: Task = {
  description: 'Run Chromatic against the sandbox',
  dependsOn: ['build'],
  junit: true,
  async ready() {
    return false;
  },
  async run({ key, builtSandboxDir, junitFilename }, { dryRun, debug }) {
    const tokenEnvVarName = `CHROMATIC_TOKEN_${key.toUpperCase().replace(/\/|-|\./g, '_')}`;
    const token = process.env[tokenEnvVarName];
    console.log('Reading Chromatic token from environment variable', tokenEnvVarName);
    if (!token && !dryRun) {
      throw new Error(`${tokenEnvVarName} is not set, so Chromatic cannot upload this sandbox.`);
    }

    // On NX, the `build` task's cached output is restored inside the repository, not into the
    // sandbox, which this task does not need: Chromatic only uploads the static build.
    const cachedBuildDir = join(
      ROOT_DIRECTORY,
      'sandbox',
      key.replace('/', '-'),
      'storybook-static'
    );
    const storybookBuildDir =
      isNxTaskExecution() && existsSync(cachedBuildDir) ? cachedBuildDir : builtSandboxDir;

    // Chromatic prints nothing while it waits for the snapshots, which can take many minutes when
    // its capture queue is busy. NX Cloud stops a worker after 10 minutes without output and then
    // cancels the whole pipeline, so say that the task is still waiting.
    const started = Date.now();
    const heartbeat = setInterval(() => {
      const minutes = Math.round((Date.now() - started) / 60_000);
      console.log(`Still waiting for Chromatic (${minutes} min)`);
    }, 60_000);

    // With `--debug`, Chromatic keeps its log and diagnostics in the working directory, the
    // repository. Beside the build they are gitignored, so the later tasks on the same NX agent,
    // such as `oxfmt --check .`, do not read them.
    const reportDir = dirname(storybookBuildDir);

    // Run from the repository, because Chromatic reads the commit, branch and baselines from git and
    // the sandbox lives outside of it.
    await exec(
      `npx chromatic \
          --debug \
          --exit-zero-on-changes \
          --storybook-build-dir=${storybookBuildDir} \
          --log-file=${join(reportDir, 'chromatic.log')} \
          --diagnostics-file=${join(reportDir, 'chromatic-diagnostics.json')} \
          ${junitFilename ? `--junit-report=${junitFilename}` : ''}`,
      // Through the environment, so the token never shows up in a logged command line. The timeout
      // bounds a Chromatic that never answers, which the heartbeat would otherwise keep alive.
      { cwd: ROOT_DIRECTORY, env: { CHROMATIC_PROJECT_TOKEN: token }, timeout: 30 * 60_000 },
      { dryRun, debug }
    ).finally(() => clearInterval(heartbeat));
  },
};
