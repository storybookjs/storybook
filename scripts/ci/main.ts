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
  defineCircleciCompletion,
  docgenMemoryGate,
  knip,
  lint,
  fmt,
  internalStorybookBuildE2e,
  internalStorybookE2e,
  storybookChromatic,
  testUnit_windows,
  testsStories_linux,
  testsUnit_linux,
} from './common-jobs.ts';
import { getInitEmpty, initEmptyNoOpJob } from './init-empty.ts';
import { getSandboxes, sandboxesNoOpJob } from './sandboxes.ts';
import { getTestStorybooks, testStorybooksNoOpJob } from './test-storybooks.ts';
import { executors } from './utils/executors.ts';
import { ensureRequiredJobs } from './utils/helpers.ts';
import { orbs } from './utils/orbs.ts';
import { parameters } from './utils/parameters.ts';
import { setTrustedAuthor } from './utils/runtime.ts';
import type {
  JobImplementationObj,
  JobOrNoOpJob,
  NoOpJobImplementationObj,
} from './utils/types.ts';
import { type Workflow, isWorkflowOrAbove } from './utils/types.ts';

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
    jobs.push(fmt);
  } else {
    const sandboxes = getSandboxes(workflow);
    const testStorybooks = getTestStorybooks(workflow);
    const initEmpty = getInitEmpty(workflow);

    if (isWorkflowOrAbove(workflow, 'daily')) {
      jobs.push(build_windows, testUnit_windows, docgenMemoryGate);
    }

    jobs.push(
      build_linux,
      testsUnit_linux,
      testsStories_linux,

      commonJobsNoOpJob,
      lint,
      fmt,
      check,
      knip,

      storybookChromatic,
      internalStorybookE2e,
      internalStorybookBuildE2e,
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
  const filteredJobs = jobs.filter((job) => !!job);

  const isDebugging = filteredJobs.length !== jobs.length;

  const ensuredJobs = ensureRequiredJobs(filteredJobs);

  // Append a completion job that depends on every other job in the workflow.
  // It acts as a single status check for GitHub branch protection: it only runs
  // (and reports success) once every required job has finished successfully.
  ensuredJobs.push(defineCircleciCompletion([...ensuredJobs]));

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
  .option(
    '--gh-trusted-author <string>',
    'Whether the pipeline can persist to shared caches',
    'false'
  )
  .parse(process.argv);

const opts = program.opts();
setTrustedAuthor(opts.ghTrustedAuthor === 'true');

await fs.writeFile(
  join(dirname, '../../.circleci/config.generated.yml'),
  yml.stringify(generateConfig(opts.workflow), null, {
    lineWidth: 1200,
    indent: 4,
  })
);
