import type { Task } from '../task';
import { exec } from '../utils/exec';
import { prepareSandbox } from '../prepare-sandbox';

export const checkSandbox: Task = {
  description: 'Typecheck a sandbox',
  dependsOn: ['sandbox'],
  async ready() {
    return false;
  },
  async run({ sandboxDir, key }, { dryRun, debug, link }) {
    await prepareSandbox({ key, link });
    await exec(`yarn typecheck`, { cwd: sandboxDir }, { dryRun, debug });
  },
};
