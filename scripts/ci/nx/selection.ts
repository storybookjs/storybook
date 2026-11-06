// The tasks a run of the NX DTE pipeline will run, and how many agents they need.
//
// CircleCI's setup job asks Nx which tasks the run's commands select (run.ts `--graph`): on a pull
// request only the tasks the change reaches (`nx affected`), elsewhere all of them. main.ts then
// sizes the agent jobs to that work (circleci-dte.ts), so a pull request that only touches docs
// starts one agent instead of 44.
//
// Like main.ts, this runs under plain Node before `yarn install`: no dependencies.

export type SelectedTask = { project: string; target: string };

export type Selection = {
  // The tasks that occupy an agent, by Nx task id. Continuous tasks (`dev`, `serve`,
  // `run-registry`) run alongside the task that needs them and are left out.
  tasks: Record<string, SelectedTask>;
  // What each task waits for, through continuous tasks: `e2e-tests-dev-1` waits for `sandbox`,
  // which its `dev` server needs.
  dependencies: Record<string, string[]>;
};

export const EMPTY_SELECTION: Selection = { tasks: {}, dependencies: {} };

type NxTaskGraph = {
  tasks: Record<string, { target: { project: string; target: string }; continuous?: boolean }>;
  dependencies: Record<string, string[]>;
  continuousDependencies?: Record<string, string[]>;
};

// Merge the task graphs of the run's commands (`nx … --graph=<file>`) into one selection.
export function mergeTaskGraphs(graphs: readonly NxTaskGraph[]): Selection {
  const all = new Map<string, { continuous: boolean; target: SelectedTask; deps: Set<string> }>();
  for (const graph of graphs) {
    for (const [id, task] of Object.entries(graph.tasks)) {
      const entry = all.get(id) ?? {
        continuous: Boolean(task.continuous),
        target: { project: task.target.project, target: task.target.target },
        deps: new Set<string>(),
      };
      for (const dep of [
        ...(graph.dependencies[id] ?? []),
        ...(graph.continuousDependencies?.[id] ?? []),
      ]) {
        entry.deps.add(dep);
      }
      all.set(id, entry);
    }
  }

  // A continuous task stands for what it waits for.
  const resolve = (id: string, seen = new Set<string>()): string[] => {
    const entry = all.get(id);
    if (!entry || seen.has(id)) {
      return [];
    }
    seen.add(id);
    return entry.continuous ? [...entry.deps].flatMap((dep) => resolve(dep, seen)) : [id];
  };

  const selection: Selection = { tasks: {}, dependencies: {} };
  for (const [id, entry] of [...all].sort(([a], [b]) => a.localeCompare(b))) {
    if (entry.continuous) {
      continue;
    }
    selection.tasks[id] = entry.target;
    selection.dependencies[id] = [
      ...new Set([...entry.deps].flatMap((dep) => resolve(dep))),
    ].sort();
  }
  return selection;
}

// How long a task of each target takes on a `large` agent when it misses the cache, in seconds:
// the median over CI runs of a week in late 2026 (NX Cloud's task statistics). Only the shape of
// the run depends on them, so they need no refresh unless a target becomes much slower or faster.
const SECONDS_BY_TARGET: Record<string, number> = {
  compile: 5,
  check: 10,
  publish: 20,
  'dedupe-check': 5,
  fmt: 10,
  lint: 60,
  'lint-affected': 30,
  knip: 20,
  'test-1': 160,
  'test-2': 155,
  'test-affected': 60,
  'test-stories': 100,
  'storybook-ui-build': 35,
  'storybook-ui-chromatic': 35,
  'e2e-internal-1': 85,
  'e2e-internal-2': 165,
  'e2e-internal-3': 60,
  'e2e-internal-4': 140,
  'e2e-internal-static-1': 50,
  'e2e-internal-static-2': 45,
  'e2e-internal-static-3': 35,
  'e2e-internal-static-4': 85,
  'bench-packages': 60,
  sandbox: 45,
  build: 30,
  chromatic: 70,
  'vitest-integration': 40,
  'smoke-test': 15,
  'docgen-baselines': 5,
  'e2e-tests': 105,
  'e2e-tests-dev-1': 145,
  'e2e-tests-dev-2': 130,
  'init-empty': 50,
  jest: 30,
  vitest: 30,
  cypress: 30,
  'e2e-ui-1': 145,
  'e2e-ui-2': 115,
  'e2e-ui-3': 150,
  'docgen-memory-gate': 90,
  'docgen-perf-gate': 415,
};
const UNKNOWN_TARGET_SECONDS = 60;

export const taskSeconds = (task: SelectedTask) =>
  SECONDS_BY_TARGET[task.target] ?? UNKNOWN_TARGET_SECONDS;

// When the run would end with the given number of agents, as NX Cloud assigns tasks: each free
// agent takes a ready task, the longest first.
export function makespan(selection: Selection, agents: number, seconds = taskSeconds) {
  const ids = Object.keys(selection.tasks);
  const done = new Map<string, number>();
  const free: number[] = Array.from({ length: Math.max(1, agents) }, () => 0);
  const pending = new Set(ids);
  while (pending.size > 0) {
    // The ready task that can start first; ties go to the longest.
    let best: { id: string; ready: number; length: number } | undefined;
    for (const id of pending) {
      const deps = selection.dependencies[id] ?? [];
      if (deps.some((dep) => pending.has(dep) && selection.tasks[dep])) {
        continue;
      }
      const ready = Math.max(0, ...deps.map((dep) => done.get(dep) ?? 0));
      const length = seconds(selection.tasks[id]);
      if (!best || ready < best.ready || (ready === best.ready && length > best.length)) {
        best = { id, ready, length };
      }
    }
    if (!best) {
      throw new Error('The selection has a dependency cycle.');
    }
    const agent = free.indexOf(Math.min(...free));
    const start = Math.max(free[agent], best.ready);
    free[agent] = start + best.length;
    done.set(best.id, free[agent]);
    pending.delete(best.id);
  }
  return Math.max(0, ...done.values());
}

// The fewest agents that end the run about as soon as `max` agents would: within `slack` (by
// default 10% or 30 seconds, whichever is more). More agents than that only add their boot time
// (about 45 seconds each on Linux) to the bill.
export function agentsNeeded(
  selection: Selection,
  max: number,
  {
    seconds = taskSeconds,
    slack = { ratio: 1.1, seconds: 30 },
  }: {
    seconds?: (task: SelectedTask) => number;
    slack?: { ratio: number; seconds: number };
  } = {}
) {
  const count = Object.keys(selection.tasks).length;
  if (count === 0) {
    return 0;
  }
  const upper = Math.min(max, count);
  const best = makespan(selection, upper, seconds);
  const goal = Math.max(best * slack.ratio, best + slack.seconds);
  // One by one: with greedy assignment, one more agent can end a run later.
  for (let agents = 1; agents < upper; agents++) {
    if (makespan(selection, agents, seconds) <= goal) {
      return agents;
    }
  }
  return upper;
}
