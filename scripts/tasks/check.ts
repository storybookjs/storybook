import { join } from 'node:path';

// eslint-disable-next-line depend/ban-dependencies
import { execaCommand } from 'execa';

import type { Task } from '../task';
import { CODE_DIRECTORY, ROOT_DIRECTORY } from '../utils/constants';
import { getCodeWorkspaces } from '../utils/workspace';

export const check: Task = {
  description: 'Typecheck the source code of the monorepo',
  async ready() {
    return false;
  },
  async run(_, {}) {
    const failed: string[] = [];
    // const command = link ? linkCommand : nolinkCommand;
    const workspaces = await getCodeWorkspaces();

    for (const workspace of workspaces) {
      if (workspace.location === '.') {
        continue; // skip root directory
      }
      const cwd = join(CODE_DIRECTORY, workspace.location);
      console.log('');
      console.log('Checking ' + workspace.name + ' at ' + cwd);

      let command = '';
      if (workspace.name === '@storybook/vue3') {
        command = `npx vue-tsc --noEmit --project ${join(cwd, 'tsconfig.json')}`;
      } else if (workspace.name === '@storybook/svelte') {
        command = `npx svelte-check`;
      } else {
        const script = join(ROOT_DIRECTORY, 'scripts', 'check', 'check-package.ts');
        command = `yarn exec jiti ${script} --cwd ${cwd}`;
        // command = `npx tsc --noEmit --project ${join(cwd, 'tsconfig.json')}`;
      }

      const sub = execaCommand(`${command}`, {
        cwd,
        env: {
          NODE_ENV: 'production',
        },
      });

      sub.stdout?.on('data', (data) => {
        process.stdout.write(data);
      });
      sub.stderr?.on('data', (data) => {
        process.stderr.write(data);
      });

      await sub.catch((error) => {
        failed.push(workspace.name);
      });
    }

    if (failed.length > 0) {
      throw new Error(`Failed to check ${failed.join(', ')}`);
    }
  },
};
