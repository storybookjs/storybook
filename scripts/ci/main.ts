import fs from 'node:fs/promises';
import { join } from 'node:path';

import { program } from 'commander';
import yml from 'yaml';

import {
  benchmarkPackages,
  build_linux,
  build_windows,
  check,
  commonJobsNoOpJob,
  knip,
  lint,
  prettyDocs,
  storybookChromatic,
  testUnit_windows,
  testsStories_linux,
  testsUnit_linux,
} from './common-jobs';
import { getInitEmpty, initEmptyNoOpJob } from './init-empty';
import { getSandboxes, sandboxesNoOpJob } from './sandboxes';
import { getTestStorybooks, testStorybooksNoOpJob } from './test-storybooks';
import { executors } from './utils/executors';
import { ensureRequiredJobs } from './utils/helpers';
import { orbs } from './utils/orbs';
import { parameters } from './utils/parameters';
import type { JobImplementationObj, JobOrNoOpJob, NoOpJobImplementationObj } from './utils/types';
import { type Workflow, isWorkflowOrAbove } from './utils/types';

const dirname = import.meta.dirname;

/**
 * Generate the CircleCI config for a given workflow.
 *
 * @param workflow - The workflow to generate the config for.
 * @returns The generated config for CircleCI in JS format.
 */
function generateConfig(workflow: Workflow) {
  const jobs: JobOrNoOpJob[] = [];
  if (isWorkflowOrAbove(workflow, 'docs')) {
    jobs.push(prettyDocs);
  } else {
    const sandboxes = getSandboxes(workflow);
    const testStorybooks = getTestStorybooks(workflow);
    const initEmpty = getInitEmpty(workflow);

    if (isWorkflowOrAbove(workflow, 'daily')) {
      jobs.push(build_windows, testUnit_windows);
    }

    jobs.push(
      build_linux,
      testsUnit_linux,
      testsStories_linux,

      commonJobsNoOpJob,
      lint,
      check,
      knip,

      storybookChromatic,
      benchmarkPackages,

      sandboxesNoOpJob,
      ...sandboxes,

      testStorybooksNoOpJob,
      ...testStorybooks,

      initEmptyNoOpJob,
      ...initEmpty
    );
  }

  /**
   * If you want to filter down to a particular job, e.g.for debugging purposes.. you can do that
   * here.
   *
   * You can filter on the `job.id` for example.
   *
   * Though is also possible to comment-out certain sandboxes in`sandbox-templates.ts`, or comment
   * out `todos.push`-statements above.
   *
   * You do not need to consider the `requires` field, as the `ensureRequiredJobs` function will
   * handle that for you.
   *
   * @example
   *
   * ```ts
   * const filteredTodos = todos.filter((job) => !!job.id.includes('qwik'));
   * ```
   */
  const filteredJobs = jobs.filter((job) => !!job.id.startsWith('lit-latest--vite---javascript'));

  const isDebugging = filteredJobs.length !== jobs.length;

  const ensuredJobs = ensureRequiredJobs(filteredJobs);

  const sortedJobs = ensuredJobs.sort((a, b) => {
    if (a.requires.length && b.requires.length) {
      return a.requires.length - b.requires.length;
    }
    if (a.requires.length) {
      return 1;
    }
    if (b.requires.length) {
      return -1;
    }
    return a.id.localeCompare(b.id);
  });

  return {
    version: 2.1,
    orbs,
    executors,
    parameters,

    jobs: sortedJobs.reduce(
      (acc, job) => {
        acc[job.id] =
          typeof job.implementation === 'function'
            ? job.implementation(workflow)
            : job.implementation;
        return acc;
      },
      {} as Record<string, JobImplementationObj | NoOpJobImplementationObj>
    ),
    workflows: {
      [`${workflow}-generated${isDebugging ? '-debug' : ''}`]: {
        jobs: sortedJobs.map((t) =>
          t.requires && t.requires.length > 0
            ? { [t.id]: { requires: t.requires.map((r) => r.id) } }
            : t.id
        ),
      },
    },
  };
}

console.log('Generating CircleCI config...');
console.log('--------------------------------');

program
  .description('Generate CircleCI config')
  .requiredOption('-w, --workflow <string>', 'Workflow to generate config for')
  .parse(process.argv);

await fs.writeFile(
  join(dirname, '../../.circleci/config.generated.yml'),
  yml.stringify(generateConfig(program.opts().workflow), null, {
    lineWidth: 1200,
    indent: 4,
  })
);
