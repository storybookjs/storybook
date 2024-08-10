import { join } from 'node:path';

import { pathExists, remove } from '@ndelangen/fs-extra-unified';

import type { Task } from '../task';
import { checkDependencies } from '../utils/cli-utils';

export const install: Task = {
  description: 'Install the dependencies of the monorepo',
  async ready({ codeDir }) {
    return pathExists(join(codeDir, 'node_modules'));
  },
  async run({ codeDir }) {
    await checkDependencies();

    // these are webpack4 types, we we should never use
    await remove(join(codeDir, 'node_modules', '@types', 'webpack'));
  },
};
