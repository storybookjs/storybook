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
import { commands } from './utils/commands';
import { executors } from './utils/executors';
import { orbs } from './utils/orbs';
import { parameters } from './utils/parameters';
import type { defineHub, defineJob } from './utils/types';
import { type JobImplementation, type Workflow, isWorkflowOrAbove } from './utils/types';

export const dirname = import.meta.dirname;

export default function generateConfig(workflow: Workflow) {
  const todos: (ReturnType<typeof defineJob> | ReturnType<typeof defineHub>)[] = [];
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

  const sorted = todos.sort((a, b) => {
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
    commands,
    executors,
    parameters,

    jobs: sorted.reduce(
      (acc, job) => {
        acc[job.id] = job.implementation;
        return acc;
      },
      {} as Record<string, JobImplementation | { type: 'no-op' }>
    ),
    workflows: {
      generated: {
        jobs: sorted.map((t) =>
          t.requires && t.requires.length > 0 ? { [t.id]: { requires: t.requires } } : t.id
        ),
      },
    },
  };
}
