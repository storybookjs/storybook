import type { Task } from '../task.ts';
import { exec } from '../utils/exec.ts';
import { prepareSandbox } from '../prepare-sandbox.ts';

export const chromatic: Task = {
  description: 'Run Chromatic against the sandbox',
  dependsOn: ['build'],
  junit: true,
  async ready() {
    return false;
  },
  async run({ key, sandboxDir, builtSandboxDir, junitFilename }, { dryRun, debug, link }) {
    await prepareSandbox({ key, link });
    const tokenEnvVarName = `CHROMATIC_TOKEN_${key.toUpperCase().replace(/\/|-|\./g, '_')}`;
    const token = process.env[tokenEnvVarName];

    await exec(
      `npx chromatic \
          --debug \
          --exit-zero-on-changes \
          --storybook-build-dir=${builtSandboxDir} \
          ${junitFilename ? `--junit-report=${junitFilename}` : ''} \
          --projectToken=${token}`,
      { cwd: sandboxDir },
      { dryRun, debug }
    );
  },
};
