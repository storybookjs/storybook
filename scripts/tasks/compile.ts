import { readFile } from 'fs-extra';
import { resolve } from 'path';

import { maxConcurrentTasks } from '../utils/maxConcurrentTasks';
import { exec } from '../utils/exec';
import type { Task } from '../task';

const parallel = `--parallel=${process.env.CI ? 8 : maxConcurrentTasks}`;

const linkedContents = `export * from '../src/index';`;
const linkCommand = `nx run-many -t build ${parallel}`;
const noLinkCommand = `nx run-many -t build -c production ${parallel}`;

export const compile: Task = {
  description: 'Compile the source code of the monorepo',
  dependsOn: ['install'],
  async ready({ codeDir }, { link }) {
    try {
      // To check if the code has been compiled as we need, we check the compiled output of
      // `@storybook/preview`. To check if it has been built for publishing (i.e. `--no-link`),
      // we check if it built types or references source files directly.
      const contents = await readFile(
        resolve(codeDir, './lib/manager-api/dist/index.d.ts'),
        'utf8'
      );
      const isLinkedContents = contents.indexOf(linkedContents) !== -1;
      if (link) return isLinkedContents;
      return !isLinkedContents;
    } catch (err) {
      return false;
    }
  },
  async run({ codeDir }, { link, dryRun, debug }) {
    return exec(
      link ? linkCommand : noLinkCommand,
      { cwd: codeDir },
      {
        startMessage: '🥾 Bootstrapping',
        errorMessage: '❌ Failed to bootstrap',
        dryRun,
        debug,
      }
    );
  },
};
