import { access, rm } from 'node:fs/promises';

import { join } from 'path';

import type { Task } from '../task';
import { checkDependencies } from '../utils/cli-utils';

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
  async ready({ codeDir }) {
    return pathExists(join(codeDir, 'node_modules'));
  },
  async run({ codeDir }) {
    await checkDependencies();

    // these are webpack4 types, we we should never use
    await rm(join(codeDir, 'node_modules', '@types', 'webpack'), { force: true, recursive: true });
  },
};
