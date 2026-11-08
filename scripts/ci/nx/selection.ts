// The tasks a run of the NX DTE pipeline will run.
//
// CircleCI's setup job asks Nx which tasks the run's commands select (run.ts `--graph`): on a pull
// request only the tasks the change reaches (`nx affected`), elsewhere all of them. It then looks up
// which of them NX Cloud already has in its cache and how long each takes, and works out the
// agents each OS needs (select.ts, agent-sizing.ts).
//
// Plain Node with no dependencies: main.ts imports it before `yarn install`.
import type { Work } from './agent-sizing.ts';
import type { Durations, History } from './nx-cloud-history.ts';

export type SelectedTask = {
  project: string;
  target: string;
  // Whether Nx may restore the task from its cache (`cache` in nx.json); Chromatic may not.
  cache: boolean;
  // The selected tasks this one waits for, also through the continuous tasks it needs: an E2E test
  // of a dev server waits for its sandbox, through `dev`.
  dependsOn: string[];
  // Nx's hash of the task's inputs, which keys its cache entry.
  hash?: string;
  // A run on NX Cloud already succeeded with this hash, so the task only restores its outputs.
  cached?: boolean;
  // How long the task takes on an agent: none when it is cached, since NX Cloud hands it to none.
  seconds?: number;
};

export type Selection = {
  // The tasks that occupy an agent, by Nx task id. Continuous tasks (`dev`, `serve`,
  // `run-registry`) run alongside the task that needs them and are left out.
  tasks: Record<string, SelectedTask>;
  // The Nx commands that select these tasks, without `yarn`, as run.ts would run them. nx-main
  // runs them as they are, without working them out again (circleci-dte.ts).
  commands?: string[][];
};

export const EMPTY_SELECTION: Selection = { tasks: {} };

// Nx 24 writes an edge as `{ id }`.
type Edge = string | { id: string };

export type NxTaskGraph = {
  tasks: Record<
    string,
    { target: { project: string; target: string }; continuous?: boolean; cache?: boolean }
  >;
  dependencies?: Record<string, Edge[]>;
  continuousDependencies?: Record<string, Edge[]>;
};

const idOf = (edge: Edge) => (typeof edge === 'string' ? edge : edge.id);

// Merge the task graphs of the run's commands (`nx … --graph=<file>`) into one selection.
export function mergeTaskGraphs(graphs: readonly NxTaskGraph[]): Selection {
  const tasks: Selection['tasks'] = {};
  for (const graph of graphs) {
    const edges = (id: string) =>
      [...(graph.dependencies?.[id] ?? []), ...(graph.continuousDependencies?.[id] ?? [])].map(
        idOf
      );
    // A continuous task stands for what it waits for.
    const waitsFor = (id: string, through: Set<string>): string[] =>
      edges(id).flatMap((dependency) => {
        if (!graph.tasks[dependency]?.continuous) {
          return [dependency];
        }
        if (through.has(dependency)) {
          return [];
        }
        through.add(dependency);
        return waitsFor(dependency, through);
      });
    for (const [id, task] of Object.entries(graph.tasks)) {
      if (!task.continuous) {
        tasks[id] = {
          project: task.target.project,
          target: task.target.target,
          cache: task.cache !== false,
          dependsOn: [...new Set([...(tasks[id]?.dependsOn ?? []), ...waitsFor(id, new Set())])],
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
// Fill in each task's hash, whether it is cached, and its seconds: the longest of the time the
// recent runs on this OS took for it (`History.seconds`) and NX Cloud's average on CI, else a guess.
// Both alone ran short in a cold core run, by 17% of the work: Chromatic's average (14 s) comes
// mostly from reruns with nothing to upload, where a new commit takes 76 s.
export function weigh(
  selection: Selection,
  hashes: Readonly<Record<string, string>>,
  history: History | undefined,
  durations: Durations | undefined
) {
  for (const [id, task] of Object.entries(selection.tasks)) {
    const key = `${task.project}:${task.target}`;
    task.hash = hashes[id];
    task.cached = task.cache && !!task.hash && !!history?.succeeded.has(task.hash);
    // The longest of what the branch's runs took and NX Cloud's average: a run that takes fewer
    // agents than it needs costs minutes, one more agent costs little.
    const seconds = Math.max(history?.seconds.get(key) ?? 0, durations?.get(key)?.missSeconds ?? 0);
    task.seconds = task.cached ? 0 : Math.round(seconds || UNKNOWN_TASK_SECONDS);
  }
}

// The work an agent count is worked out from (agent-sizing.ts).
export const workOf = (selection: Selection): Work =>
  Object.fromEntries(
    Object.entries(selection.tasks).map(([id, task]) => [
      id,
      { seconds: task.seconds ?? UNKNOWN_TASK_SECONDS, dependsOn: task.dependsOn ?? [] },
    ])
  );
