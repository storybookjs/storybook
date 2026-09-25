import fs from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import {
  benchmarkPackages,
  build_linux,
  build_windows,
  check,
  commonJobsNoOpJob,
  defineCircleciCompletion,
  docgenMemoryGate,
  docgenPerfGate,
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
import { defineFocusJob, getChangedFiles, selectFocusSandbox } from './focus.ts';
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

type GenerateConfigOptions = { trustedAuthor: boolean } & (
  | { workflow: 'focus'; changedFiles: readonly string[] }
  | { workflow: Exclude<Workflow, 'focus'> }
);

function parseWorkflow(value: string | undefined): Workflow {
  const workflow = parameters.workflow.enum.find((candidate) => candidate === value);

  if (workflow === undefined) {
    throw new Error(
      `--workflow must be one of: ${parameters.workflow.enum.join(', ')}. Received: ${value ?? 'missing'}`
    );
  }

  return workflow;
}

function parseTrustedAuthor(value: string): boolean {
  if (value !== 'true' && value !== 'false') {
    throw new Error(`--gh-trusted-author must be true or false. Received: ${value}`);
  }

  return value === 'true';
}

export function generateConfig(options: GenerateConfigOptions) {
  const { workflow } = options;
  setTrustedAuthor(options.trustedAuthor);
  const jobs: JobOrNoOpJob[] = [];
  if (workflow === 'focus') {
    jobs.push(defineFocusJob(selectFocusSandbox(options.changedFiles)));
  } else if (isWorkflowOrAbove(workflow, 'docs')) {
    jobs.push(fmt);
  } else {
    const sandboxes = getSandboxes(workflow);
    const testStorybooks = getTestStorybooks();
    const initEmpty = getInitEmpty(workflow);

    if (isWorkflowOrAbove(workflow, 'daily')) {
      jobs.push(build_windows, testUnit_windows, docgenMemoryGate, docgenPerfGate);
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

async function run(argv: string[]) {
  console.log('Generating CircleCI config...');
  console.log('--------------------------------');

  const { values } = parseArgs({
    args: argv,
    options: {
      workflow: { type: 'string', short: 'w' },
      'base-ref': { type: 'string', default: 'origin/next' },
      'gh-trusted-author': { type: 'string', default: 'false' },
    },
    strict: true,
  });

  const workflow = parseWorkflow(values.workflow);
  const trustedAuthor = parseTrustedAuthor(values['gh-trusted-author']);

  const options: GenerateConfigOptions =
    workflow === 'focus'
      ? { workflow, trustedAuthor, changedFiles: getChangedFiles(values['base-ref']) }
      : { workflow, trustedAuthor };

  await fs.writeFile(
    join(dirname, '../../.circleci/config.generated.yml'),
    `${JSON.stringify(generateConfig(options), null, 2)}\n`
  );
}

if (process.argv[1] === import.meta.filename) {
  run(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
