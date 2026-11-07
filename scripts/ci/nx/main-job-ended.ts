// Whether this CircleCI workflow's main NX job (`nx-main`, `nx-main-windows`) has ended, for the
// agent jobs (run-agent.sh): an agent waits for its NX Cloud run, also for one the main job never
// started, as when it failed to check out. Exits 0 when the job has ended, 1 while it runs or when
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
