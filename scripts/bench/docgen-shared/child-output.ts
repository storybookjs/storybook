/**
 * The last `count` lines of a measured child's combined stdout and stderr, indented as a log block.
 * Enough to see why a run failed without spilling a full V8 crash dump into the output.
 */
export function outputTail(output: string, count: number): string {
  return output
    .trim()
    .split('\n')
    .slice(-count)
    .map((line) => `    ${line}`)
    .join('\n');
}
