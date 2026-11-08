// Whether a job of this CircleCI workflow has ended, for run-until-ended.sh: an NX agent stops once
// its main job (`nx-main`, `nx-main-windows`) has ended, and a main job once all of its agents have
// (`nx-agent`, `nx-agent-windows`; CircleCI ends a parallel job when its last container ends).
// Exits 0 when the job has ended, 1 while it runs, when the workflow has no such job, or when
// CircleCI does not answer.
//
// CircleCI's API needs no token for this public project. Plain Node, run after `yarn install`.
const RUNNING = new Set(['running', 'queued', 'not_running', 'blocked', 'on_hold']);

type Job = { name: string; status: string };

export const hasEnded = (jobs: readonly Job[], name: string) => {
  const status = jobs.find((job) => job.name === name)?.status;
  return status !== undefined && !RUNNING.has(status);
};

async function main() {
  const [name] = process.argv.slice(2);
  const response = await fetch(
    `https://circleci.com/api/v2/workflow/${process.env.CIRCLE_WORKFLOW_ID}/job`,
    { signal: AbortSignal.timeout(15_000) }
  ).catch(() => undefined);
  const jobs = response?.ok ? ((await response.json()) as { items: Job[] }).items : [];
  process.exit(hasEnded(jobs, name) ? 0 : 1);
}

if (import.meta.main) {
  await main();
}
