import type { Task } from '../task.ts';
import { exec } from '../utils/exec.ts';
import { prepareSandbox } from '../prepare-sandbox.ts';

export const vitestTests: Task = {
  description: 'Run the Vitest tests of a sandbox',
  dependsOn: ['sandbox'],
  async ready() {
    return false;
  },
  async run({ sandboxDir, key }, { dryRun, debug, link }) {
    await prepareSandbox({ key, link });
    console.log(`running Vitest tests in ${sandboxDir}`);

    return exec(`yarn vitest run --testTimeout=15000`, { cwd: sandboxDir }, { dryRun, debug });
  },
};
