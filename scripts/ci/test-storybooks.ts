import { readFileSync } from 'fs';
import { join } from 'path/posix';

import { CACHE_KEYS, cache, defineJob, git, workspace } from './utils';

export function definePortableStoryTest(directory: string) {
  const working_directory = `test-storybooks/portable-stories-kitchen-sink/${directory}`;

  const { scripts } = JSON.parse(
    readFileSync(join(import.meta.dirname, '..', '..', working_directory, 'package.json'), 'utf8')
  );

  return defineJob(
    `test-storybooks-portable-${directory}`,
    {
      executor: {
        name: 'sb_playwright',
        class: 'medium',
      },
      steps: [
        git.checkout(),
        workspace.attach(),
        cache.attach(CACHE_KEYS()),
        {
          run: {
            name: 'Install dependencies',
            working_directory,
            command: 'yarn install --no-immutable',
            environment: {
              YARN_ENABLE_IMMUTABLE_INSTALLS: false,
            },
          },
        },
        {
          run: {
            name: 'Run Jest tests',
            working_directory,
            command: 'yarn jest',
          },
        },
        {
          run: {
            name: 'Run Vitest tests',
            working_directory,
            command: 'yarn vitest',
          },
        },
        {
          run: {
            name: 'Run Playwright CT tests',
            working_directory,
            command: 'yarn playwright-ct',
          },
        },
        ...(scripts['playwright-e2e']
          ? [
              {
                run: {
                  name: 'Run Playwright E2E tests',
                  working_directory,
                  command: 'yarn playwright-e2e',
                },
              },
            ]
          : []),
        {
          run: {
            name: 'Run Cypress CT tests',
            working_directory,
            command: 'yarn cypress',
          },
        },
      ],
    },
    ['test-storybooks']
  );
}
