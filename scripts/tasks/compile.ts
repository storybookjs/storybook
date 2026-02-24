import { readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import type { Task } from '../task';
import { ROOT_DIRECTORY } from '../utils/constants';
import { exec } from '../utils/exec';
import { maxConcurrentTasks } from '../utils/maxConcurrentTasks';

// The amount of VCPUs for the check task on CI is 4 (large resource)
const amountOfVCPUs = 2;

const parallel = `--parallel=${process.env.CI ? amountOfVCPUs - 1 : maxConcurrentTasks}`;

const linkCommand = `yarn nx run-many -t compile ${parallel}`;
const noLinkCommand = `yarn nx run-many -t compile -c production ${parallel}`;

export const compile: Task = {
  description: 'Compile the source code of the monorepo',
  dependsOn: ['install'],
  async ready({ codeDir }, { link }) {
    try {
      if (link) {
        await readFile(resolve(codeDir, './core/dist/manager-api/index.js'), 'utf8');
      } else {
        await readFile(resolve(codeDir, './core/dist/manager-api/index.d.ts'), 'utf8');
      }
      return true;
    } catch (err) {
      return false;
    }
  },
  async run({ codeDir }, { link, dryRun, debug, prod, skipCache }) {
    const command = link && !prod ? linkCommand : noLinkCommand;
    await rm(join(codeDir, 'bench/esbuild-metafiles'), { recursive: true, force: true });
    return exec(
      `${command} ${skipCache || process.env.CI ? '--skip-nx-cache' : ''}`,
      { cwd: ROOT_DIRECTORY },
      {
        startMessage: '🥾 Bootstrapping',
        errorMessage: '❌ Failed to bootstrap',
        dryRun,
        debug,
      }
    );
  },
};
