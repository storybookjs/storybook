import type { Task } from '../task.ts';
import { exec } from '../utils/exec.ts';
import { prepareSandbox } from '../prepare-sandbox.ts';

export const smokeTest: Task = {
  description: 'Run the smoke tests of a sandbox',
  dependsOn: ['sandbox'],
  async ready() {
    return false;
  },
  async run({ key, sandboxDir }, { dryRun, debug, link }) {
    // On NX the sandbox may come from the cache, without node_modules.
    await prepareSandbox({ key, link });
    console.log(`smoke testing in ${sandboxDir}`);

    return exec(`yarn storybook --smoke-test`, { cwd: sandboxDir }, { dryRun, debug });
  },
};
