// Nx's hash of each selected task, as the run will compute it, for CircleCI's setup job (select.ts):
// the hash keys the task's cache entry, so a hash an earlier run stored is a task that only
// restores. With Nx's own hasher, so a change to how Nx hashes cannot make the two disagree.
//
// The Windows tasks are hashed here on Linux with Windows' `OS`, the one input that differs
// (`sharedGlobals` in nx.json; the repository checks files out unchanged, `* -text`).
import { readNxJson } from 'nx/src/config/nx-json.js';
import { createTaskHasher } from 'nx/src/hasher/create-task-hasher.js';
import { createProjectGraphAsync } from 'nx/src/project-graph/project-graph.js';
import { createTaskGraph } from 'nx/src/tasks-runner/create-task-graph.js';

import type { Selection } from './selection.ts';

export async function hashSelection(
  selection: Selection,
  env: 'linux' | 'windows'
): Promise<Record<string, string>> {
  const tasks = Object.values(selection.tasks);
  if (tasks.length === 0) {
    return {};
  }
  const graph = await createProjectGraphAsync({ exitOnError: true });
  const taskGraph = createTaskGraph(
    graph,
    {},
    [...new Set(tasks.map((task) => task.project))],
    [...new Set(tasks.map((task) => task.target))],
    'production',
    {}
  );
  const ids = Object.keys(selection.tasks).filter((id) => taskGraph.tasks[id]);
  const hashes = await createTaskHasher(graph, readNxJson()).hashTasks(
    ids.map((id) => taskGraph.tasks[id]),
    taskGraph,
    { ...process.env, ...(env === 'windows' ? { OS: 'Windows_NT' } : {}) }
  );
  return Object.fromEntries(ids.map((id, i) => [id, hashes[i].value]));
}
