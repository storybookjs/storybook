import type { Task } from '../task';
import { exec } from '../utils/exec';

export const checkSandbox: Task = {
  description: 'Typecheck a sandbox',
  dependsOn: ['sandbox'],
  async ready() {
    return false;
  },
  async run({ sandboxDir }, { dryRun, debug }) {
    await exec(`yarn typecheck`, { cwd: sandboxDir }, { dryRun, debug });
  },
};
