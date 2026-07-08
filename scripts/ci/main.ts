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
import {
  getSandboxSplitAtoms,
  getSandboxes,
  getSplitSandboxes,
  sandboxesNoOpJob,
} from './sandboxes.ts';
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
import { STATIC_WORKFLOWS, type Workflow, isWorkflowOrAbove } from './utils/types.ts';

const dirname = import.meta.dirname;

/**
 * Parse the `workflow` pipeline parameter into its atoms.
 *
 * A single cadence workflow (`normal`, `merged`, `daily`, `docs`) behaves as before. Split atoms
 * (`core`, a framework such as `react`, or a builder such as `vite`) can be combined with `+`,
 * e.g. `core+react`, and the resulting config is the union of each atom's jobs.
 */
function parseWorkflowAtoms(value: string): Workflow[] {
  const atoms = value.split('+').filter(Boolean);
  // `skipped` never reaches the generator: the setup workflow in .circleci/config.yml does not
  // run for it, so it is not accepted here either.
  const validAtoms = [
    ...STATIC_WORKFLOWS.filter((workflow) => workflow !== 'skipped'),
    ...getSandboxSplitAtoms(),
  ];
  const invalidAtoms = atoms.filter((atom) => !validAtoms.includes(atom));
  if (atoms.length === 0 || invalidAtoms.length > 0) {
    throw new Error(
      `Invalid --workflow value "${value}". Each "+"-separated atom must be one of: ${validAtoms.join(', ')}`
    );
  }
  return atoms;
}

/** Collect the jobs for a single workflow atom. */
function collectJobs(workflow: Workflow): JobOrNoOpJob[] {
  const jobs: JobOrNoOpJob[] = [];
  if (isWorkflowOrAbove(workflow, 'docs')) {
    jobs.push(fmt);
  } else if (getSandboxSplitAtoms().includes(workflow)) {
    jobs.push(sandboxesNoOpJob, ...getSplitSandboxes(workflow));
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
      check,

      storybookChromatic,
      internalStorybookE2e,
      internalStorybookBuildE2e,
      benchmarkPackages,

      // `core` runs no sandboxes at all; leave the group out instead of
      // emitting an orphaned no-op job.
      ...(sandboxes.length > 0 ? [sandboxesNoOpJob, ...sandboxes] : []),

      testStorybooksNoOpJob,
      ...testStorybooks,

      initEmptyNoOpJob,
      ...initEmpty
    );
  }
  return jobs;
}

/**
 * Generate the CircleCI config for a given workflow.
 *
 * @param workflowParam - The value of the `workflow` pipeline parameter (one or more atoms).
 * @returns The generated config for CircleCI in JS format.
 */
function generateConfig(workflowParam: string) {
  const atoms = parseWorkflowAtoms(workflowParam);
  // Duplicate jobs across atoms (e.g. `react+vite` both containing react-vite
  // sandboxes) are deduplicated by id in `ensureRequiredJobs`.
  const jobs: JobOrNoOpJob[] = atoms.flatMap(collectJobs);

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
            ? job.implementation(workflowParam)
            : job.implementation;
        return acc;
      },
      {} as Record<string, JobImplementationObj | NoOpJobImplementationObj>
    ),
    workflows: {
      [`${atoms.join('-')}-generated${isDebugging ? '-debug' : ''}`]: {
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
