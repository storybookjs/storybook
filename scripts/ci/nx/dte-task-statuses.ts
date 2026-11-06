// Puts each task that failed in an NX DTE pipeline (circleci-dte.ts) on the pull request as a commit
// status `nx run <task>`, linked to the task's log on NX Cloud. On CircleCI only `nx-main` turns red
// for a failed task, and the agent that ran it stays green.
//
// Runs on GitHub Actions (.github/workflows/trigger-circleci-nx-dte.yml) right after it starts the
// pipeline, because only GitHub's own token may write commit statuses: it waits for `nx-main`, then
// reads the failed tasks from its log.
//
// Usage: dte-task-statuses.ts --pipeline=<CircleCI pipeline id> --workflow=<workflows>
// Needs CIRCLE_TOKEN, GITHUB_TOKEN and GITHUB_REPOSITORY. Like main.ts, it runs before `yarn install`.
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';

import { esMain } from '../../utils/esmain.ts';
import { NX_MAIN_JOB, RUN_NX_STEP } from './circleci-dte.ts';

const CIRCLECI = 'https://circleci.com/api';
// The workflow of .circleci/config.yml that generates the pipeline's real workflow.
const SETUP_WORKFLOW = 'setup';
const POLL_MS = 30_000;
const MAX_WAIT_MS = 80 * 60_000;
const MAX_STATUSES = 10;
// CircleCI job states after which the job cannot change any more (`blocked` waits for another job).
const FINISHED_JOB = new Set([
  'success',
  'failed',
  'canceled',
  'infrastructure_fail',
  'timedout',
  'not_run',
  'unauthorized',
  'terminated-unknown',
]);
const FINISHED_WORKFLOW = new Set([
  'success',
  'failed',
  'error',
  'canceled',
  'unauthorized',
  'not_run',
]);

export interface FailedTask {
  task: string;
  url?: string;
}

export interface CommitStatus {
  context: string;
  state: 'error' | 'failure' | 'pending' | 'success';
  description?: string | null;
  target_url?: string | null;
}

// The failed rows of Nx's distributed summary table, each with the `> Task logs:` link on the next
// line. The table cuts task names longer than 37 characters off with `…`.
export function parseFailedTasks(log: string): FailedTask[] {
  const lines = log.replace(/\x1b\[[0-9;]*m/g, '').split(/\r?\n/);
  return lines.flatMap((line, i) => {
    const task = line.match(/✖\s+Failed\s+(\S+)/)?.[1];
    const url = lines[i + 1]?.match(/Task logs:\s*(https:\/\/cloud\.nx\.app\/\S+)/)?.[1];
    return task ? [{ task, url }] : [];
  });
}

// The full task id from a task log link, which redirects to `/runs/<run>/task/<task id>`.
export function taskFromLogRedirect(location: string | null): string | undefined {
  const id = location?.match(/\/task\/([^/?#]+)/)?.[1];
  return id ? decodeURIComponent(id) : undefined;
}

const suffix = (workflow: string) => `(nx:${workflow})`;

export function failureStatuses(failures: FailedTask[], workflow: string): CommitStatus[] {
  return failures.map(({ task, url }) => ({
    context: `nx run ${task}`,
    state: 'failure',
    description: `Failed on the NX agents ${suffix(workflow)}`,
    target_url: url,
  }));
}

// After a green run, the task failures an earlier run of the same workflows left on the commit. Not
// after a failed run: a task that a failed dependency kept from running would turn green.
export function clearedStatuses(existing: CommitStatus[], workflow: string): CommitStatus[] {
  return existing
    .filter(
      (status) =>
        status.context.startsWith('nx run ') &&
        status.state === 'failure' &&
        status.description?.endsWith(suffix(workflow))
    )
    .map((status) => ({
      context: status.context,
      state: 'success',
      description: `Passed on a later run ${suffix(workflow)}`,
      target_url: status.target_url,
    }));
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, init);
    if (response.ok) {
      return (await response.json()) as T;
    }
    if (attempt >= 3 || (response.status < 500 && response.status !== 429)) {
      throw new Error(
        `${init.method ?? 'GET'} ${url}: ${response.status} ${await response.text()}`
      );
    }
    await sleep(10_000 * attempt);
  }
}

const circleci = <T>(path: string) =>
  request<T>(`${CIRCLECI}${path}`, { headers: { 'Circle-Token': process.env.CIRCLE_TOKEN ?? '' } });

const github = <T>(path: string, body?: unknown) =>
  request<T>(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

interface Job {
  name: string;
  status: string;
  job_number?: number;
}

interface Workflow {
  id: string;
  name: string;
  status: string;
  created_at: string;
}

// The `nx-main` of the pipeline's newest workflow once it has finished, or `null` when there is none:
// CircleCI rejected the config, the setup failed or was canceled, or the workflow runs no NX tasks.
async function waitForMainJob(pipeline: string): Promise<Job | null> {
  const deadline = Date.now() + MAX_WAIT_MS;
  let setupEnded = 0;
  while (Date.now() < deadline) {
    const workflows = (
      await circleci<{ items: Workflow[] }>(`/v2/pipeline/${pipeline}/workflow`)
    ).items.sort((a, b) => b.created_at.localeCompare(a.created_at));
    const generated = workflows.find((workflow) => workflow.name !== SETUP_WORKFLOW);
    if (generated) {
      const jobs = (await circleci<{ items: Job[] }>(`/v2/workflow/${generated.id}/job`)).items;
      const main = jobs.find((job) => job.name === NX_MAIN_JOB);
      if (!main || FINISHED_JOB.has(main.status)) {
        return main ?? null;
      }
    } else if (workflows.length === 0) {
      const { state } = await circleci<{ state: string }>(`/v2/pipeline/${pipeline}`);
      if (state === 'errored') {
        return null;
      }
    } else if (workflows.every((workflow) => FINISHED_WORKFLOW.has(workflow.status))) {
      // A poll may land between the end of the setup job and the start of the next workflow.
      if (++setupEnded >= 2) {
        return null;
      }
    }
    await sleep(POLL_MS);
  }
  throw new Error(`${NX_MAIN_JOB} did not finish within ${MAX_WAIT_MS / 60_000} minutes.`);
}

async function commitStatuses(sha: string) {
  const statuses: CommitStatus[] = [];
  for (let page = 1; ; page++) {
    const batch = (
      await github<{ statuses: CommitStatus[] }>(`/commits/${sha}/status?per_page=100&page=${page}`)
    ).statuses;
    statuses.push(...batch);
    if (batch.length < 100) {
      return statuses;
    }
  }
}

async function runNxLog(jobNumber: number) {
  const job = await circleci<{
    steps: { name: string; actions: { output_url?: string | null }[] }[];
  }>(`/v1.1/project/github/${process.env.GITHUB_REPOSITORY}/${jobNumber}`);
  const outputUrl = job.steps.find((step) => step.name === RUN_NX_STEP)?.actions[0]?.output_url;
  if (!outputUrl) {
    return '';
  }
  const output = await request<{ message: string }[]>(outputUrl);
  return output.map(({ message }) => message).join('');
}

async function completeTaskName(failure: FailedTask): Promise<FailedTask> {
  if (!failure.task.endsWith('…') || !failure.url) {
    return failure;
  }
  try {
    const response = await fetch(failure.url, { method: 'HEAD', redirect: 'manual' });
    return {
      ...failure,
      task: taskFromLogRedirect(response.headers.get('location')) ?? failure.task,
    };
  } catch {
    return failure;
  }
}

async function main() {
  const { values } = parseArgs({
    options: { pipeline: { type: 'string' }, workflow: { type: 'string' } },
  });
  const { pipeline, workflow } = values;
  if (!pipeline || !workflow) {
    throw new Error('Usage: dte-task-statuses.ts --pipeline=<id> --workflow=<workflows>');
  }

  const { vcs } = await circleci<{ vcs: { revision: string } }>(`/v2/pipeline/${pipeline}`);
  const main = await waitForMainJob(pipeline);
  if (!main?.job_number || !['success', 'failed'].includes(main.status)) {
    console.log(`No task statuses: ${NX_MAIN_JOB} ${main ? main.status : 'never ran'}.`);
    return;
  }

  const statuses =
    main.status === 'success'
      ? clearedStatuses(await commitStatuses(vcs.revision), workflow)
      : failureStatuses(
          await Promise.all(
            parseFailedTasks(await runNxLog(main.job_number))
              .slice(0, MAX_STATUSES)
              .map(completeTaskName)
          ),
          workflow
        );

  console.log(`${NX_MAIN_JOB} ${main.status}: ${statuses.length} status(es) on ${vcs.revision}.`);
  for (const status of statuses) {
    console.log(`  ${status.state} ${status.context} ${status.target_url ?? ''}`);
    await github(`/statuses/${vcs.revision}`, status);
  }
}

if (esMain(import.meta.url)) {
  await main();
}
