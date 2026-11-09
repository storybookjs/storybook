// Nx's hash of each selected task, as the run will compute it, for CircleCI's setup job (select.ts):
// the hash keys the task's cache entry, so a hash an earlier run stored is a task that only
// restores. With Nx's own hasher, so a change to how Nx hashes cannot make the two disagree; these
// are Nx internals, and select.ts warns when no hash matches an earlier run's.
//
// This holds only while no input is `dependentTasksOutputFiles`: such a task's hash is known only
// once the tasks it depends on ran (https://github.com/nrwl/nx/discussions/23419).
// task-hashes.test.ts keeps it so.
//
// The Windows tasks are hashed here on Linux with Windows' `OS` (`sharedGlobals` in nx.json; the
// repository checks files out unchanged, `* -text`), and with the npm packages as Nx names them on
// Windows, where other native packages are installed (windows-graph.ts).
import { readNxJson } from 'nx/src/config/nx-json.js';
import type { ProjectGraph } from 'nx/src/config/project-graph.js';
import { createTaskHasher } from 'nx/src/hasher/create-task-hasher.js';
import { createTaskGraph } from 'nx/src/tasks-runner/create-task-graph.js';
import { workspaceRoot } from 'nx/src/utils/workspace-root.js';

import type { Selection } from './selection.ts';
import { windowsGraph } from './windows-graph.ts';

type Os = 'linux' | 'windows';

// `projectGraph` is the project graph select.ts built, which is Linux's.
export async function hashSelections(
  selections: Record<Os, Selection>,
  projectGraph: ProjectGraph
): Promise<Record<Os, Record<string, string>>> {
  const linuxGraph = projectGraph;
  const graphs = { linux: linuxGraph, windows: linuxGraph };
  if (Object.keys(selections.windows.tasks).length > 0) {
    try {
      graphs.windows = windowsGraph(linuxGraph, workspaceRoot);
    } catch (error) {
      // Only the Windows hashes then miss, and every Windows task counts as one that runs.
      console.warn(`Naming the npm packages as on Windows failed: ${error}`);
    }
  }
  const hash = async (selection: Selection, os: Os) => {
    const tasks = Object.values(selection.tasks);
    if (tasks.length === 0) {
      return {};
    }
    const graph = graphs[os];
    const hasher = createTaskHasher(graph, readNxJson());
    const taskGraph = createTaskGraph(
      graph,
      {},
      [...new Set(tasks.map((task) => task.project))],
      [...new Set(tasks.map((task) => task.target))],
      'production',
      {}
    );
    const ids = Object.keys(selection.tasks).filter((id) => taskGraph.tasks[id]);
    const hashes = await hasher.hashTasks(
      ids.map((id) => taskGraph.tasks[id]),
      taskGraph,
      { ...process.env, ...(os === 'windows' ? { OS: 'Windows_NT' } : {}) }
    );
    return Object.fromEntries(ids.map((id, i) => [id, hashes[i].value]));
  };
  return {
    linux: await hash(selections.linux, 'linux'),
    windows: await hash(selections.windows, 'windows'),
  };
}
