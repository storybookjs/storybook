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
    // `immutable: false` because on NX the cached sandbox's yarn.lock
    // references whichever snapshot-versioned @storybook/* packages the
    // original agent published to verdaccio, but each chromatic agent
    // republishes with a fresh sha — `--immutable` would always refuse.
    // Matches CircleCI's chromatic job which doesn't reinstall at all
    // (workspace persist handles node_modules there).
    await prepareSandbox({ key, link, immutable: false });
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
