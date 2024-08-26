import { cpus } from 'node:os';

/**
 * The maximum number of concurrent tasks we want to have on some CLI and CI tasks. The amount of
 * CPUS minus one, arbitrary limited to 15 to not overload CI executors.
 *
 * @type {number}
 */
export const maxConcurrentTasks = Math.min(Math.max(1, cpus().length - 1), 15);
