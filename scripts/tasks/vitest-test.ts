import type { Task } from '../task';
import { exec } from '../utils/exec';

export const vitestTests: Task = {
  description: 'Run the Vitest tests of a sandbox',
  dependsOn: ['sandbox'],
  async ready() {
    return false;
  },
  async run({ sandboxDir }, { dryRun, debug }) {
    console.log(`running Vitest tests in ${sandboxDir}`);

    return exec(`yarn vitest`, { cwd: sandboxDir }, { dryRun, debug });
  },
};
