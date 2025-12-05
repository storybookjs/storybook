import type { Task } from '../task';
import { ROOT_DIRECTORY } from '../utils/constants';
import { exec } from '../utils/exec';
import { maxConcurrentTasks } from '../utils/maxConcurrentTasks';

// The amount of VCPUs for the check task on CI is 4 (large resource)
const amountOfVCPUs = 4;

const parallel = `--parallel=${process.env.CI ? amountOfVCPUs - 1 : maxConcurrentTasks}`;

const linkCommand = `yarn nx run-many -t check ${parallel}`;
const nolinkCommand = `yarn nx run-many -t check -c production ${parallel}`;

export const check: Task = {
  description: 'Typecheck the source code of the monorepo',
  async ready() {
    return false;
  },
  async run(_, { dryRun, debug, link, skipCache }) {
    const command = link ? linkCommand : nolinkCommand;
    return exec(
      `${command} ${skipCache || process.env.CI ? '--skip-nx-cache' : ''}`,
      { cwd: ROOT_DIRECTORY },
      {
        startMessage: '🥾 Checking for TS errors',
        errorMessage: '❌ TS errors detected',
        dryRun,
        debug,
      }
    );
  },
};
