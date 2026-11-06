// How many agents a run of the NX DTE pipeline needs (circleci-dte.ts), worked out from the tasks it
// will run (select.ts): for each task how long it takes and what it waits for. NX Cloud hands an
// agent only the tasks it has no cache entry for, so a cached task takes no agent time; it only
// says when the tasks that wait for it can start.
//
// A simulation of the run gives, for each number of agents, when the run ends and how many
// agent-seconds it bills: agents boot, then each takes the ready task with the longest chain of work
// behind it, one task at a time (.nx/workflows/*assignment-rules.yaml), and stops once no task is
// left to hand out. The run gets the number with the lowest cost, where a second the run takes
// longer weighs as {@link WAIT_WORTH} agent-seconds.
//
// Plain Node with no dependencies: main.ts imports it before `yarn install`.

export type WorkTask = { seconds: number; dependsOn: readonly string[] };
export type Work = Readonly<Record<string, WorkTask>>;

// Speed first: a minute sooner green is worth this many agent-minutes (about 400 credits on Linux),
// so an agent starts when it makes the run at least three seconds faster for each minute it bills.
// At 4, a cold core run started 24 agents instead of 44: 500 credits cheaper, but 1m46s slower.
export const WAIT_WORTH = 20;

// Linux agents are `large` containers (4 vCPUs; a task costs more on `xlarge`, which bills twice
// the credits per minute and ran the dev-server E2E tests only a quarter faster). A Windows `large`
// agent costs 120 credits a minute and boots in about four minutes, which also bounds how many pay
// off.
export const MAX_AGENTS = { linux: 44, windows: 4 } as const;
// From the job's start until an agent's first task runs: checkout, node_modules and Chromium (about
// 45 seconds on Linux), then the outputs of every `compile` the task depends on, which NX Cloud
// downloads once per agent (about 55). Measured on the core runs of #37232.
export const AGENT_BOOT_SECONDS = { linux: 100, windows: 240 } as const;

// Each task's chain: its own seconds plus the longest chain of the tasks that wait for it.
function chains(work: Work) {
  const dependents = new Map<string, string[]>();
  for (const [id, task] of Object.entries(work)) {
    for (const dependency of task.dependsOn) {
      dependents.set(dependency, [...(dependents.get(dependency) ?? []), id]);
    }
  }
  const chain = new Map<string, number>();
  const of = (id: string): number => {
    const known = chain.get(id);
    if (known !== undefined) {
      return known;
    }
    const after = (dependents.get(id) ?? []).filter((d) => d in work).map(of);
    const value = work[id].seconds + Math.max(0, ...after);
    chain.set(id, value);
    return value;
  };
  return new Map(Object.keys(work).map((id) => [id, of(id)]));
}

export type Simulation = {
  // When the last task ends, from the start of the run.
  seconds: number;
  // What the agents bill: each from its start until it stops.
  agentSeconds: number;
};

export function simulate(work: Work, agents: number, bootSeconds: number): Simulation {
  const ids = Object.keys(work);
  if (ids.length === 0) {
    return { seconds: 0, agentSeconds: 0 };
  }
  const chain = chains(work);
  const finish = new Map<string, number>();
  const free = Array.from({ length: agents }, () => bootSeconds);
  const waiting = new Set(ids);
  let lastStart = 0;
  while (waiting.size > 0) {
    const agent = free.indexOf(Math.min(...free));
    // The tasks whose dependencies are all handed out, and when they can start.
    const ready = [...waiting]
      .filter((id) => work[id].dependsOn.every((d) => !(d in work) || finish.has(d)))
      .map((id) => ({
        id,
        at: Math.max(0, ...work[id].dependsOn.map((d) => finish.get(d) ?? 0)),
      }));
    const start = Math.max(free[agent], Math.min(...ready.map((task) => task.at)));
    const next = ready
      .filter((task) => task.at <= start)
      .sort((a, b) => chain.get(b.id)! - chain.get(a.id)!)[0];
    const done = start + work[next.id].seconds;
    finish.set(next.id, done);
    free[agent] = done;
    waiting.delete(next.id);
    lastStart = Math.max(lastStart, start);
  }
  // An agent waits for work until the last task is handed out, then stops after its own.
  const ends = free.map((end) => Math.max(end, lastStart));
  return {
    seconds: Math.max(...finish.values()),
    agentSeconds: ends.reduce((sum, end) => sum + end, 0),
  };
}

// The number of agents, up to `max`, with the lowest cost.
export function agentsFor(
  work: Work,
  { max, bootSeconds }: { max: number; bootSeconds: number }
): { agents: number } & Simulation {
  const tasks = Object.keys(work).length;
  if (tasks === 0) {
    return { agents: 0, seconds: 0, agentSeconds: 0 };
  }
  let best: { agents: number; cost: number } & Simulation = {
    agents: 0,
    cost: Infinity,
    seconds: 0,
    agentSeconds: 0,
  };
  // Never more agents than tasks: each runs one at a time.
  for (let agents = 1; agents <= Math.min(max, tasks); agents++) {
    const run = simulate(work, agents, bootSeconds);
    const cost = run.agentSeconds + WAIT_WORTH * run.seconds;
    if (cost < best.cost) {
      best = { agents, cost, ...run };
    }
  }
  const { cost, ...result } = best;
  return result;
}
