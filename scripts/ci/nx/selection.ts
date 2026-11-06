// The tasks a run of the NX DTE pipeline will run.
//
// CircleCI's setup job asks Nx which tasks the run's commands select (run.ts `--graph`): on a pull
// request only the tasks the change reaches (`nx affected`), elsewhere all of them. main.ts then
// sizes the agent jobs to that work (circleci-dte.ts), so a pull request that only touches docs
// starts one agent instead of 44.

export type SelectedTask = { project: string; target: string };

export type Selection = {
  // The tasks that occupy an agent, by Nx task id. Continuous tasks (`dev`, `serve`,
  // `run-registry`) run alongside the task that needs them and are left out.
  tasks: Record<string, SelectedTask>;
};

export const EMPTY_SELECTION: Selection = { tasks: {} };

type NxTaskGraph = {
  tasks: Record<string, { target: { project: string; target: string }; continuous?: boolean }>;
};

// Merge the task graphs of the run's commands (`nx … --graph=<file>`) into one selection.
export function mergeTaskGraphs(graphs: readonly NxTaskGraph[]): Selection {
  const tasks: Selection['tasks'] = {};
  for (const graph of graphs) {
    for (const [id, task] of Object.entries(graph.tasks)) {
      if (!task.continuous) {
        tasks[id] = { project: task.target.project, target: task.target.target };
      }
    }
  }
  return {
    tasks: Object.fromEntries(Object.entries(tasks).sort(([a], [b]) => a.localeCompare(b))),
  };
}
