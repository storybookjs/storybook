import { join } from 'node:path';

// eslint-disable-next-line depend/ban-dependencies
import { execaCommand } from 'execa';
import pLimit from 'p-limit';

import type { Task } from '../task.ts';
import { CODE_DIRECTORY, ROOT_DIRECTORY } from '../utils/constants.ts';
import { maxConcurrentTasks } from '../utils/maxConcurrentTasks.ts';
import { getCodeWorkspaces } from '../utils/workspace.ts';

// The typescript-validation job runs on an xlarge (8 vCPU) executor. The
// native TS 7 compiler run by check-package.ts is itself multi-threaded
// (~4 threads per process observed), so the pool stays narrower than the
// vCPU count. os.cpus() inside Docker reports the host's cores rather than
// the cgroup limit, so use an explicit value on CI instead of
// maxConcurrentTasks (same reasoning as compile.ts).
const CI_CONCURRENCY = 4;

// Started first so the slowest checks don't begin last and stretch the tail of
// the parallel run.
const HEAVY_WORKSPACES = [
  'storybook',
  '@storybook/vue3',
  '@storybook/svelte',
  '@storybook/angular',
];

function getCheckCommand(name: string, cwd: string) {
  if (name === '@storybook/vue3') {
    return `npx vue-tsc --noEmit --project ${join(cwd, 'tsconfig.json')}`;
  }
  if (name === '@storybook/svelte') {
    return `npx svelte-check`;
  }
  const script = join(ROOT_DIRECTORY, 'scripts', 'check', 'check-package.ts');
  return `node ${script} --cwd ${cwd}`;
}

export const check: Task = {
  description: 'Typecheck the source code of the monorepo',
  async ready() {
    return false;
  },
  async run(_, {}) {
    const failed: string[] = [];
    const workspaces = (await getCodeWorkspaces()).filter(
      (workspace) => workspace.location !== '.'
    );

    workspaces.sort((a, b) => {
      const rank = (name: string) => {
        const index = HEAVY_WORKSPACES.indexOf(name);
        return index === -1 ? HEAVY_WORKSPACES.length : index;
      };
      return rank(a.name) - rank(b.name);
    });

    // Halved locally for the same multi-threading reason as CI_CONCURRENCY.
    const limit = pLimit(
      process.env.CI ? CI_CONCURRENCY : Math.max(2, Math.ceil(maxConcurrentTasks / 2))
    );

    await Promise.all(
      workspaces.map((workspace) =>
        limit(async () => {
          const cwd = join(CODE_DIRECTORY, workspace.location);
          const command = getCheckCommand(workspace.name, cwd);

          try {
            await execaCommand(command, {
              cwd,
              env: { NODE_ENV: 'production' },
              all: true,
            });
            console.log(`✅ ${workspace.name}`);
          } catch (error) {
            failed.push(workspace.name);
            console.log(`❌ ${workspace.name}`);
            // Output is buffered per package so parallel runs stay readable.
            const output = (error as { all?: string }).all;
            console.log(output || String(error));
          }
        })
      )
    );

    if (failed.length > 0) {
      throw new Error(`Failed to check ${failed.join(', ')}`);
    }
  },
};
