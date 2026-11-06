// The tasks a run of the NX DTE pipeline will run.
//
// CircleCI's setup job asks Nx which tasks the run's commands select (run.ts `--graph`): on a pull
// request only the tasks the change reaches (`nx affected`), elsewhere all of them. It then looks up
// which of them NX Cloud already has in its cache and how long each takes (select.ts), and main.ts
// sizes the agent jobs to the work that is left (agent-sizing.ts).
import type { Work } from './agent-sizing.ts';

export type SelectedTask = {
  project: string;
  target: string;
  // Whether Nx may restore the task from its cache (`cache` in nx.json); Chromatic may not.
  cache: boolean;
  // The selected tasks this one waits for.
  dependsOn: string[];
  // Nx's hash of the task's inputs, which keys its cache entry.
  hash?: string;
  // A run on NX Cloud already succeeded with this hash, so the task only restores its outputs.
  cached?: boolean;
  // How long the task takes: its usual cache-miss time on CI, or a restore when it is cached.
  seconds?: number;
};

export type Selection = {
  // The tasks that occupy an agent, by Nx task id. Continuous tasks (`dev`, `serve`,
  // `run-registry`) run alongside the task that needs them and are left out.
  tasks: Record<string, SelectedTask>;
};

export const EMPTY_SELECTION: Selection = { tasks: {} };

type NxTaskGraph = {
  tasks: Record<
    string,
    { target: { project: string; target: string }; continuous?: boolean; cache?: boolean }
  >;
  dependencies?: Record<string, string[]>;
};

// Merge the task graphs of the run's commands (`nx … --graph=<file>`) into one selection.
export function mergeTaskGraphs(graphs: readonly NxTaskGraph[]): Selection {
  const tasks: Selection['tasks'] = {};
  for (const graph of graphs) {
    for (const [id, task] of Object.entries(graph.tasks)) {
      if (!task.continuous) {
        tasks[id] = {
          project: task.target.project,
          target: task.target.target,
          cache: task.cache !== false,
          dependsOn: [
            ...new Set([...(tasks[id]?.dependsOn ?? []), ...(graph.dependencies?.[id] ?? [])]),
          ],
        };
      }
    }
  }
  for (const task of Object.values(tasks)) {
    task.dependsOn = task.dependsOn.filter((dependency) => dependency in tasks).sort();
  }
  return {
    tasks: Object.fromEntries(Object.entries(tasks).sort(([a], [b]) => a.localeCompare(b))),
  };
}

// A task the setup job knows nothing more about: a few CI tasks take less, the E2E tests more.
export const UNKNOWN_TASK_SECONDS = 60;
// A cached task the setup job has no restore time for.
export const CACHE_HIT_SECONDS = 5;

// The work an agent count is worked out from (agent-sizing.ts).
export const workOf = (selection: Selection): Work =>
  Object.fromEntries(
    Object.entries(selection.tasks).map(([id, task]) => [
      id,
      { seconds: task.seconds ?? UNKNOWN_TASK_SECONDS, dependsOn: task.dependsOn ?? [] },
    ])
  );
