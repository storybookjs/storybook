// eslint-disable-next-line depend/ban-dependencies
import { pathExists } from 'fs-extra';
import { resolve } from 'path';

import type { Task } from '../task';
import { exec } from '../utils/exec';

const verdaccioCacheDir = resolve(__dirname, '../../.verdaccio-cache');

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
