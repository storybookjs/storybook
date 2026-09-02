import { access } from 'node:fs/promises';

import { resolve } from 'path';

import type { Task } from '../task.ts';
import { exec } from '../utils/exec.ts';

const verdaccioCacheDir = resolve(__dirname, '../../.verdaccio-cache');

const pathExists = async (path: string) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

export const publish: Task = {
  description: 'Publish the packages of the monorepo to an internal npm server',
  dependsOn: ['compile'],
  async ready() {
    return pathExists(verdaccioCacheDir);
  },
  async run({ codeDir }, { dryRun, debug }) {
    return exec(
      'yarn local-registry --publish',
      { cwd: codeDir },
      {
        startMessage: '📕 Publishing packages',
        errorMessage: '❌ Failed publishing packages',
        dryRun,
        debug,
      }
    );
  },
};
