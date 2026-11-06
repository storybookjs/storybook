import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { defineCircleciCompletion, defineNightlyFailureReport } from './common-jobs.ts';
import { executors } from './utils/executors.ts';
import { cancelWorkflowStep, ensureRequiredJobs } from './utils/helpers.ts';
import { orbs } from './utils/orbs.ts';
import { parameters } from './utils/parameters.ts';
import { setLockfileChanged, setTrustedAuthor } from './utils/runtime.ts';
import type { JobImplementationObj, NoOpJobImplementationObj } from './utils/types.ts';
import { type Workflow, workflows } from './utils/types.ts';
import { getJobs } from './workflow-jobs.ts';

const dirname = import.meta.dirname;

// refs/pull/<n>/merge is the pull request merged into its base, so its diff against its first
// parent needs two commits of history, where a merge base can be any number of commits back.
// GitHub stops updating it while the pull request conflicts, so it must merge HEAD to count.
// It is fetched into a scratch repository because a `--depth` fetch marks the parents it stops
// at as shallow, which would cut the checkout's own history at HEAD.
function getPullRequestChangedFiles(prNumber: string): string[] | undefined {
  if (!/^\d+$/.test(prNumber)) {
    throw new Error(`Invalid pull request number "${prNumber}"`);
  }
  const git = (cwd: string, ...args: string[]) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const scratch = mkdtempSync(join(tmpdir(), 'pull-request-merge-'));
  try {
    const origin = git('.', 'remote', 'get-url', 'origin');
    git(scratch, 'init', '--quiet', '--bare');
    git(
      scratch,
      'fetch',
      '--depth=2',
      '--filter=blob:none',
      '--no-tags',
      origin,
      `refs/pull/${prNumber}/merge`
    );
    if (git(scratch, 'rev-parse', 'FETCH_HEAD^2') !== git('.', 'rev-parse', 'HEAD')) {
      throw new Error(`refs/pull/${prNumber}/merge does not merge HEAD`);
    }
    return git(scratch, 'diff', '--name-only', 'FETCH_HEAD^1', 'FETCH_HEAD')
      .split('\n')
      .filter(Boolean);
  } catch (error) {
    console.warn(`Skipping checks that need the files pull request ${prNumber} changes: ${error}`);
    return undefined;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

/** Workflows that a PR can merge on, so they end in the `circleci-completion` status check. */
const isMergeGating = (workflow: Workflow) => workflow !== 'windows';

/**
 * Generate the CircleCI config for the union of the given workflows.
 *
 * @param selected - The workflows to generate the config for, in `workflows` order. Jobs report
 *   failures as the first, most thorough one.
 * @param baseRef - The git ref `focus` diffs against.
 * @param nightly - Whether this is the scheduled `daily` run on `next`, which reports its failures
 *   instead of cancelling on the first one.
 * @returns The generated config for CircleCI in JS format.
 */
function generateConfig(selected: Workflow[], baseRef: string, nightly: boolean) {
  const [workflow] = selected;
  const jobs = selected.flatMap((workflow) => getJobs(workflow, baseRef));

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
  if (selected.some(isMergeGating)) {
    const completion = defineCircleciCompletion([...ensuredJobs]);
    ensuredJobs.push(completion);

    if (nightly) {
      ensuredJobs.push(defineNightlyFailureReport(completion));
    }
  }

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
        const implementation =
          typeof job.implementation === 'function'
            ? job.implementation(workflow)
            : job.implementation;
        // The nightly run keeps going so its failure report lists every failed job.
        acc[job.id] =
          nightly && 'steps' in implementation
            ? {
                ...implementation,
                steps: implementation.steps.filter((step) => step !== cancelWorkflowStep),
              }
            : implementation;
        return acc;
      },
      {} as Record<string, JobImplementationObj | NoOpJobImplementationObj>
    ),
    workflows: {
      [`${selected.join('-')}-generated${isDebugging ? '-debug' : ''}`]: {
        jobs: sortedJobs.map((t) =>
          t.requires && t.requires.length > 0
            ? {
                [t.id]: {
                  requires: t.requires.map((r) =>
                    t.runsEvenIfRequirementsFail ? { [r.id]: 'terminal' } : r.id
                  ),
                },
              }
            : t.id
        ),
      },
    },
  };
}

console.log('Generating CircleCI config...');
console.log('--------------------------------');

const { values: opts } = parseArgs({
  options: {
    workflow: { type: 'string', short: 'w' },
    'base-ref': { type: 'string', default: 'origin/next' },
    'gh-trusted-author': { type: 'string', default: 'false' },
    'gh-pr-number': { type: 'string', default: '' },
    branch: { type: 'string', default: '' },
  },
});
setTrustedAuthor(opts['gh-trusted-author'] === 'true');
setLockfileChanged(
  opts['gh-pr-number'] !== '' &&
    (getPullRequestChangedFiles(opts['gh-pr-number']) ?? []).includes('pnpm-lock.yaml')
);

const requested = (opts.workflow ?? '').split(',').filter(Boolean);
const unknown = requested.filter((w) => !(workflows as readonly string[]).includes(w));
if (unknown.length > 0 || requested.length === 0) {
  throw new Error(
    `Unknown workflow "${opts.workflow ?? ''}". Expected a comma-separated list of: ${workflows.join(', ')}`
  );
}
const selected = workflows.filter((w) => requested.includes(w));
const nightly = selected.includes('daily') && opts.branch === 'next';

await fs.writeFile(
  join(dirname, '../../.circleci/config.generated.yml'),
  `${JSON.stringify(generateConfig(selected, opts['base-ref'], nightly), null, 2)}\n`
);
