import { createInterface } from 'node:readline';

import { type SubprocessOptions, spawnSubprocess } from '../common/utils/subprocess.ts';

/**
 * Execute a command in the local terminal and count the lines in the result
 *
 * @param command The command to execute.
 * @param options Subprocess options
 * @returns The number of lines the command returned
 */
export async function execCommandCountLines(
  command: string,
  args: string[],
  options?: SubprocessOptions
) {
  const process = spawnSubprocess(command, args, { buffer: false, ...options });
  if (!process.stdout) {
    // eslint-disable-next-line local-rules/no-uncategorized-errors
    throw new Error('Unexpected missing stdout');
  }

  let lineCount = 0;
  const rl = createInterface(process.stdout);
  rl.on('line', () => {
    lineCount += 1;
  });

  // If the process errors, this will throw
  await process;

  rl.close();

  return lineCount;
}
