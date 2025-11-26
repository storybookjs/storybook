import { createInterface } from 'node:readline';

// eslint-disable-next-line depend/ban-dependencies
import { execa } from 'execa';

/**
 * Execute a command in the local terminal and count the lines in the result
 *
 * @param command The command to execute.
 * @param options Execa options
 * @returns The number of lines the command returned
 */
export async function execCommandCountLines(
  command: string,
  args: string[],
  options?: Parameters<typeof execa>[1]
) {
  const process = execa(command, args, { buffer: false, ...options });
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
