import type { Task } from '../task';
import { exec } from '../utils/exec';

export const smokeTest: Task = {
  description: 'Run the smoke tests of a sandbox',
  dependsOn: ['sandbox'],
  async ready() {
    return false;
  },
  async run({ sandboxDir }, { dryRun, debug }) {
    console.log(`smoke testing in ${sandboxDir}`);

    return exec(`yarn storybook --smoke-test`, { cwd: sandboxDir }, { dryRun, debug });
  },
};
