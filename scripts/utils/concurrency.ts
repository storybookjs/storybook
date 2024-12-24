import os from 'node:os';

/**
 * The maximum number of concurrent tasks we want to have on some CLI and CI tasks. The amount of
 * CPUS minus one, arbitrary limited to 5 to not overload CI executors.
 */
export const maxConcurrentTasks = Math.min(
  Math.max(1, os.cpus().length - 1),
  process.env.CI ? 5 : 15
);
