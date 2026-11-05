/**
 * Compares CircleCI workflows: the per-job pipeline against the NX DTE pipeline
 * (scripts/ci/nx/circleci-dte.ts), as one Markdown table.
 *
 * Per workflow it reports when `circleci-completion` ended (when the pull request's check turns
 * green), the wall time (created until stopped), the longest time a job waited in CircleCI's queue,
 * the billed container minutes and the credits they cost. For an NX DTE workflow it also reports
 * when `nx-main` ended (which decides the check), and splits that job into the setup before
 * `Run nx` and the task phase itself.
 *
 * Usage:
 *   CIRCLE_TOKEN=… node scripts/ci/nx/circleci-benchmark.ts <workflow>...
 *
 * A workflow is its id or its app.circleci.com link. CIRCLE_TOKEN is a personal CircleCI API token.
 */
import { parseArgs } from 'node:util';

import { esMain } from '../../utils/esmain.ts';

/**
 * CircleCI's credits per minute by resource class, from its price list. A credit costs $0.0006 on
 * the Performance plan; what an organization pays depends on its plan.
 */
export const CREDITS_PER_MINUTE: Record<string, Record<string, number>> = {
  docker: { small: 5, medium: 10, 'medium+': 15, large: 20, xlarge: 40, '2xlarge': 80 },
  windows: { medium: 40, large: 120, xlarge: 210, '2xlarge': 500 },
};
const DOLLARS_PER_CREDIT = 0.0006;

type Step = {
  name: string;
  actions: { index: number; start_time?: string; end_time?: string; status: string }[];
};
type JobDetails = {
  queued_at?: string;
  start_time?: string;
  stop_time?: string;
  /** `executor` is `docker`, `windows`, …; the resource class carries only its size. */
  picard?: { executor?: string; resource_class?: { class?: string } };
  steps: Step[];
  workflows?: { job_name?: string };
};

export type JobTiming = {
  name: string;
  executor: string;
  resourceClass: string;
  queuedAt?: number;
  startedAt?: number;
  stoppedAt?: number;
  /** Billed minutes: per container, from its first step's start to its last step's end. */
  containerMinutes: number;
  steps: { name: string; start: number; end: number }[];
};

const time = (iso?: string) => (iso ? Date.parse(iso) : undefined);

/** The timing of a job from CircleCI's v1.1 job details. */
export function jobTiming(details: JobDetails): JobTiming {
  const spans = new Map<number, [number, number]>();
  const steps: JobTiming['steps'] = [];
  for (const step of details.steps) {
    const timed = step.actions.filter((a) => a.start_time && a.end_time);
    for (const action of timed) {
      const [start, end] = [time(action.start_time)!, time(action.end_time)!];
      const [first, last] = spans.get(action.index) ?? [start, end];
      spans.set(action.index, [Math.min(first, start), Math.max(last, end)]);
    }
    if (timed.length > 0) {
      steps.push({
        name: step.name,
        start: Math.min(...timed.map((a) => time(a.start_time)!)),
        end: Math.max(...timed.map((a) => time(a.end_time)!)),
      });
    }
  }
  const rc = details.picard?.resource_class ?? {};
  return {
    name: details.workflows?.job_name ?? '?',
    executor: details.picard?.executor === 'windows' ? 'windows' : 'docker',
    resourceClass: rc.class ?? '?',
    queuedAt: time(details.queued_at),
    startedAt: time(details.start_time),
    stoppedAt: time(details.stop_time),
    containerMinutes: [...spans.values()].reduce((sum, [s, e]) => sum + (e - s) / 60_000, 0),
    steps,
  };
}

export const creditsOf = (job: JobTiming) =>
  job.containerMinutes * (CREDITS_PER_MINUTE[job.executor]?.[job.resourceClass] ?? 0);

export type WorkflowReport = {
  name: string;
  status: string;
  jobs: number;
  wallMinutes: number;
  /** Until `circleci-completion` ended: when the pull request's check turns green. */
  greenMinutes?: number;
  maxQueueMinutes: number;
  containerMinutes: number;
  credits: number;
  /** NX DTE workflows only: until `nx-main` ended, which decides whether the check turns green. */
  mainMinutes?: number;
  /** NX DTE workflows only: the main job from its start until `Run nx`, and `Run nx` itself. */
  setupMinutes?: number;
  taskMinutes?: number;
};

export function report(
  workflow: { name: string; status: string; created_at: string; stopped_at?: string },
  jobs: JobTiming[]
): WorkflowReport {
  const main = jobs.find((job) => job.name === 'nx-main');
  const runNx = main?.steps.find((step) => step.name === 'Run nx');
  const completion = jobs.find((job) => job.name === 'circleci-completion');
  const minutes = (ms: number) => ms / 60_000;
  return {
    name: workflow.name,
    status: workflow.status,
    jobs: jobs.length,
    wallMinutes: minutes((time(workflow.stopped_at) ?? Date.now()) - time(workflow.created_at)!),
    greenMinutes: completion?.stoppedAt
      ? minutes(completion.stoppedAt - time(workflow.created_at)!)
      : undefined,
    maxQueueMinutes: Math.max(
      0,
      ...jobs
        .filter((job) => job.queuedAt && job.startedAt)
        .map((job) => minutes(job.startedAt! - job.queuedAt!))
    ),
    containerMinutes: jobs.reduce((sum, job) => sum + job.containerMinutes, 0),
    credits: jobs.reduce((sum, job) => sum + creditsOf(job), 0),
    ...(main?.stoppedAt
      ? { mainMinutes: minutes(main.stoppedAt - time(workflow.created_at)!) }
      : {}),
    ...(main?.startedAt && runNx
      ? {
          setupMinutes: minutes(runNx.start - main.startedAt),
          taskMinutes: minutes(runNx.end - runNx.start),
        }
      : {}),
  };
}

const mmss = (minutes?: number) => {
  if (minutes === undefined) {
    return '–';
  }
  const seconds = Math.round(minutes * 60);
  return `${Math.floor(seconds / 60)}m${String(seconds % 60).padStart(2, '0')}s`;
};

export function toMarkdown(reports: WorkflowReport[]) {
  const rows = reports.map((r) =>
    [
      r.name,
      r.status,
      r.jobs,
      mmss(r.greenMinutes),
      mmss(r.mainMinutes),
      mmss(r.wallMinutes),
      mmss(r.maxQueueMinutes),
      mmss(r.setupMinutes),
      mmss(r.taskMinutes),
      Math.round(r.containerMinutes),
      `${Math.round(r.credits)} (~$${(r.credits * DOLLARS_PER_CREDIT).toFixed(2)})`,
    ].join(' | ')
  );
  return [
    '| Workflow | Status | Jobs | Green | Main | Wall | Max queue | Setup | Tasks | Container-min | Credits |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows.map((row) => `| ${row} |`),
  ].join('\n');
}

async function circleci<T>(url: string, attempt = 1): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { headers: { 'Circle-Token': process.env.CIRCLE_TOKEN! } });
  } catch (error) {
    if (attempt >= 3) {
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    return circleci<T>(url, attempt + 1);
  }
  if (!response.ok) {
    throw new Error(`${url}: ${response.status} ${response.statusText}`);
  }
  // Step output in job details can hold raw control characters, which JSON.parse rejects.
  return JSON.parse((await response.text()).replace(/[\u0000-\u001f]/g, ' ')) as T;
}

async function main() {
  const { positionals } = parseArgs({ allowPositionals: true });
  if (!process.env.CIRCLE_TOKEN || positionals.length === 0) {
    console.error('Usage: CIRCLE_TOKEN=… node scripts/ci/nx/circleci-benchmark.ts <workflow>...');
    process.exit(2);
  }
  const reports: WorkflowReport[] = [];
  for (const target of positionals) {
    const id = target.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)?.[0];
    if (!id) {
      throw new Error(`Not a CircleCI workflow id or link: ${target}`);
    }
    const workflow = await circleci<Parameters<typeof report>[0]>(
      `https://circleci.com/api/v2/workflow/${id}`
    );
    const jobs: { job_number?: number }[] = [];
    let pageToken: string | undefined;
    do {
      const page = await circleci<{ items: typeof jobs; next_page_token?: string }>(
        `https://circleci.com/api/v2/workflow/${id}/job${pageToken ? `?page-token=${pageToken}` : ''}`
      );
      jobs.push(...page.items);
      pageToken = page.next_page_token ?? undefined;
    } while (pageToken);
    // A few at a time: a workflow has up to ~150 jobs.
    const queue = jobs.filter((job) => job.job_number);
    const timings: JobTiming[] = [];
    await Promise.all(
      Array.from({ length: 8 }, async () => {
        for (let job = queue.shift(); job; job = queue.shift()) {
          try {
            timings.push(
              jobTiming(
                await circleci<JobDetails>(
                  `https://circleci.com/api/v1.1/project/github/storybookjs/storybook/${job.job_number}`
                )
              )
            );
          } catch (error) {
            // The v1.1 API answers 404 for a few jobs, such as approvals.
            console.error(`Skipping job ${job.job_number}: ${(error as Error).message}`);
          }
        }
      })
    );
    reports.push(report(workflow, timings));
  }
  console.log(toMarkdown(reports));
}

if (esMain(import.meta.url)) {
  await main();
}
