import { access } from 'node:fs/promises';

import type { Task } from '../task';
import { exec } from '../utils/exec';

async function pathExists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export const checkSandbox: Task = {
  description: 'Typecheck the a sandbox',
  dependsOn: ['sandbox'],
  async ready({ builtSandboxDir }) {
    return pathExists(builtSandboxDir);
  },
  async run({ sandboxDir }, { dryRun, debug }) {
    await exec(`yarn typecheck`, { cwd: sandboxDir }, { dryRun, debug });
  },
};
