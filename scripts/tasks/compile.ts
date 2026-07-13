import { readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import type { Task } from '../task.ts';
import { ROOT_DIRECTORY } from '../utils/constants.ts';
import { exec } from '../utils/exec.ts';
import { maxConcurrentTasks } from '../utils/maxConcurrentTasks.ts';

// The compile task only actually runs in the build--linux / build--windows
// jobs, both on xlarge executors (8 vCPUs). os.cpus() reports the Docker
// host's cores rather than the cgroup limit, so use an explicit value on CI
// instead of maxConcurrentTasks.
const CI_VCPUS = 8;

const parallel = `--parallel=${process.env.CI ? CI_VCPUS : maxConcurrentTasks}`;

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
      `${command} ${skipCache ? '--skip-nx-cache' : ''}`,
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
