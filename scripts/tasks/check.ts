import type { Task } from '../task';
import { ROOT_DIRECTORY } from '../utils/constants';
import { exec } from '../utils/exec';
import { maxConcurrentTasks } from '../utils/maxConcurrentTasks';

// The amount of VCPUs for the check task on CI is 8 (xlarge resource)
const amountOfVCPUs = 8;

const parallel = `--parallel=${process.env.CI ? amountOfVCPUs - 1 : maxConcurrentTasks}`;

const linkCommand = `yarn nx run-many -t check ${parallel} --skip-nx-cache`;
const nolinkCommand = `yarn nx run-many -t check -c production ${parallel} --skip-nx-cache`;

export const check: Task = {
  description: 'Typecheck the source code of the monorepo',
  async ready() {
    return false;
  },
  async run(_, { dryRun, debug, link }) {
    return exec(
      link ? linkCommand : nolinkCommand,
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
