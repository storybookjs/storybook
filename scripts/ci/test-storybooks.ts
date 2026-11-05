import { readFileSync } from 'fs';

import { build_linux } from './common-jobs.ts';
import { artifact, workflow } from './utils/helpers.ts';
import { type JobOrNoOpJob, defineJob, defineNoOpJob } from './utils/types.ts';

export function definePortableStoryTest(directory: string) {
  const working_directory = `test-storybooks/portable-stories-kitchen-sink/${directory}`;

  const { scripts } = JSON.parse(
    readFileSync(new URL(`../../${working_directory}/package.json`, import.meta.url), 'utf8')
  );

  return defineJob(
    `test-storybooks-portable-${directory}`,
    () => ({
      executor: {
        name: 'sb_playwright',
        class: 'medium+',
      },
      steps: [
        ...workflow.restoreLinux(),
        {
          run: {
            name: 'Install dependencies',
            working_directory,
            // The Storybook packages come from code/ through `file:` resolutions, so the lockfile
            // follows their manifests and cannot be frozen.
            command: 'pnpm install --no-frozen-lockfile',
          },
        },
        {
          run: {
            name: 'Run Jest tests',
            working_directory,
            command: 'pnpm jest',
          },
        },
        {
          run: {
            name: 'Run Vitest tests',
            working_directory,
            command: 'pnpm vitest',
          },
        },
        ...(scripts['playwright-e2e']
          ? [
              {
                run: {
                  name: 'Run Playwright E2E tests',
                  working_directory,
                  command: 'pnpm playwright-e2e',
                },
              },
              artifact.persist(`${working_directory}/test-results`, 'playwright'),
            ]
          : []),
        {
          run: {
            name: 'Run Cypress CT tests',
            working_directory,
            command: 'pnpm cypress',
          },
        },
      ],
    }),
    [testStorybooksNoOpJob]
  );
}

export function defineMcpTestStorybook() {
  return defineJob(
    'test-storybooks-mcp',
    () => ({
      executor: {
        name: 'sb_playwright',
        class: 'medium+',
      },
      steps: [
        ...workflow.restoreLinux(),
        {
          run: {
            name: 'Install dependencies',
            working_directory: 'test-storybooks/mcp',
            command: 'pnpm install --no-frozen-lockfile',
          },
        },
        {
          run: {
            name: 'Run MCP addon e2e tests',
            working_directory: 'test-storybooks/mcp',
            command: 'pnpm exec vitest run --project=e2e',
          },
        },
        {
          run: {
            name: 'Run internal Storybook story tests',
            working_directory: 'test-storybooks/mcp',
            command: 'pnpm exec vitest run --project=storybook',
          },
        },
      ],
    }),
    [testStorybooksNoOpJob]
  );
}

export const testStorybooksNoOpJob = defineNoOpJob('test-storybooks', [build_linux]);

export function getTestStorybooks() {
  const testStorybooks: JobOrNoOpJob[] = ['react', 'vue3', 'svelte', 'nextjs'].map(
    definePortableStoryTest
  );

  testStorybooks.push(defineMcpTestStorybook());

  return testStorybooks;
}
