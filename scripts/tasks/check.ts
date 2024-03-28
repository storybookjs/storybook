import type { Task } from '../task';
import { exec } from '../utils/exec';
import { maxConcurrentTasks } from '../utils/maxConcurrentTasks';

// The amount of VCPUs for the check task on CI is 8 (xlarge resource)
const amountOfVCPUs = 8;

const parallel = `--parallel=${process.env.CI ? amountOfVCPUs - 1 : maxConcurrentTasks}`;

const linkCommand = `nx affected -t check ${parallel}`;
const nolinkCommand = `nx affected -t check -c production ${parallel}`;

export const check: Task = {
  description: 'Typecheck the source code of the monorepo',
  async ready() {
    return false;
  },
  async run({ codeDir }, { dryRun, debug, link }) {
    return exec(
      link ? linkCommand : nolinkCommand,
      { cwd: codeDir },
      {
        startMessage: '🥾 Checking for TS errors',
        errorMessage: '❌ TS errors detected',
        dryRun,
        debug,
      }
    );
  },
};
