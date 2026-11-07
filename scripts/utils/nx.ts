import { join } from 'pathe';

export function isNxTaskExecution(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.NX_TASK_TARGET_PROJECT);
}

// Under NX, `<root>/<project>/<target>`: the tasks of one NX agent run one after another in one
// checkout, so each keeps its results apart, and the `outputs` in nx.json cache only its own.
export function nxTaskResultsDirectory(root: string, env: NodeJS.ProcessEnv = process.env) {
  return isNxTaskExecution(env)
    ? join(root, env.NX_TASK_TARGET_PROJECT!, env.NX_TASK_TARGET_TARGET!)
    : root;
}
