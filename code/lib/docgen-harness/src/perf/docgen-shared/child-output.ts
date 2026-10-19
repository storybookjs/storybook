export function outputTail(output: string, count: number): string {
  return output
    .trim()
    .split('\n')
    .slice(-count)
    .map((line) => `    ${line}`)
    .join('\n');
}
