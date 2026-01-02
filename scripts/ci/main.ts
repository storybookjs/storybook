import fs from 'node:fs/promises';
import { join } from 'node:path';

import { program } from 'commander';
import yml from 'yaml';

import {
  benchmarkPackages,
  build_linux,
  build_windows,
  check,
  codeHub,
  knip,
  lint,
  prettyDocs,
  storybookChromatic,
  testUnit_windows,
  testsStories_linux,
  testsUnit_linux,
} from './code';
import { getInitEmpty, initEmptyHub } from './init-empty';
import { getSandboxes, sandboxesHub } from './sandboxes';
import { getTestStorybooks, testStorybooksHub } from './test-storybooks';
import { executors } from './utils/executors';
import { ensureRequiredJobs } from './utils/helpers';
import { orbs } from './utils/orbs';
import { parameters } from './utils/parameters';
import type { HubImplementation, JobsOrHub } from './utils/types';
import { type JobImplementation, type Workflow, isWorkflowOrAbove } from './utils/types';

const dirname = import.meta.dirname;

/**
 * Generate the CircleCI config for a given workflow.
 *
 * @param workflow - The workflow to generate the config for.
 * @returns The generated config for CircleCI in JS format.
 */
function generateConfig(workflow: Workflow) {
  const todos: JobsOrHub[] = [];
  if (isWorkflowOrAbove(workflow, 'docs')) {
    todos.push(prettyDocs);
  } else {
    const sandboxes = getSandboxes(workflow);
    const testStorybooks = getTestStorybooks(workflow);
    const initEmpty = getInitEmpty(workflow);

    if (isWorkflowOrAbove(workflow, 'merged')) {
      todos.push(build_windows, testUnit_windows);
    }

    todos.push(
      build_linux,
      testsUnit_linux,
      testsStories_linux,

      codeHub,
      lint,
      check,
      knip,

      storybookChromatic,
      benchmarkPackages,

      sandboxesHub,
      ...sandboxes,

      testStorybooksHub,
      ...testStorybooks,

      initEmptyHub,
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
  const filteredTodos = todos.filter((job) => !!job);

  const isDebugging = filteredTodos.length !== todos.length;

  const ensured = ensureRequiredJobs(filteredTodos);

  const sorted = ensured.sort((a, b) => {
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

    jobs: sorted.reduce(
      (acc, job) => {
        acc[job.id] = job.implementation;
        return acc;
      },
      {} as Record<string, JobImplementation | HubImplementation>
    ),
    workflows: {
      [`${workflow}-generated${isDebugging ? '-debug' : ''}`]: {
        jobs: sorted.map((t) =>
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
