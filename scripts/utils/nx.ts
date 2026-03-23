export function isNxTaskExecution(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.NX_TASK_TARGET_PROJECT);
}
