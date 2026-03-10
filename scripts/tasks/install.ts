import { access } from 'node:fs/promises';

import { join } from 'path';

import type { Task } from '../task';
import { checkDependencies } from '../utils/cli-utils';
import { ROOT_DIRECTORY } from '../utils/constants';

const pathExists = async (path: string) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

export const install: Task = {
  description: 'Install the dependencies of the monorepo',
  async ready() {
    return pathExists(join(ROOT_DIRECTORY, 'node_modules'));
  },
  async run() {
    await checkDependencies();
  },
};
