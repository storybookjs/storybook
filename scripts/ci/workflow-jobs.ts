import {
  benchmarkPackages,
  build_linux,
  build_windows,
  check,
  commonJobsNoOpJob,
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
import { getChangedFiles, getFocusJobs } from './focus.ts';
import { getInitEmpty, initEmptyNoOpJob } from './init-empty.ts';
import { getSandboxes, getWindowsSandboxes, sandboxesNoOpJob } from './sandboxes.ts';
import { getTestStorybooks, testStorybooksNoOpJob } from './test-storybooks.ts';
import { type JobOrNoOpJob, type Workflow, isWorkflowOrAbove } from './utils/types.ts';

export function getJobs(workflow: Workflow, baseRef: string): JobOrNoOpJob[] {
  const jobs: JobOrNoOpJob[] = [];
  if (workflow === 'focus') {
    jobs.push(...getFocusJobs(getChangedFiles(baseRef)));
  } else if (isWorkflowOrAbove(workflow, 'docs')) {
    jobs.push(fmt);
  } else if (workflow === 'windows') {
    jobs.push(build_windows, testUnit_windows);
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
  return jobs;
}
