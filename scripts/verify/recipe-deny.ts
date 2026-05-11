// Static deny-regex pass for agent-generated Playwright recipes.
// Pure function — no I/O. Throws on the first matched pattern, naming the
// pattern label and the (1-based) line number for actionable feedback.
//
// The deny list deliberately excludes dynamic `import(` (D6 iter-2 decision):
// it has too high a false-positive risk against legitimate test usage, and
// lint plus human review cover the realistic abuse surface.

export const DENY_PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
  ['child_process', /\bchild_process\b/],
  ['fs.unlink*', /\bfs\.unlink\w*/],
  ['fs.rm', /\bfs\.rm\b/],
  ['fs.rmdir', /\bfs\.rmdir\b/],
  ['fsp.unlink*', /\bfsp\.unlink\w*/],
  ['fsp.rm', /\bfsp\.rm\b/],
  ['process.exit', /\bprocess\.exit\b/],
  ['eval(', /\beval\s*\(/],
  ['import node:', /\bimport\s+['"`]node:/],
  ['require(node:)', /\brequire\s*\(\s*['"`]node:/],
  ['require(child_process)', /\brequire\s*\(\s*['"`]child_process/],
];

/**
 * Throws an Error if the given source contains any denied pattern.
 * Error message includes the pattern label and the 1-based line number
 * where the first match was found.
 */
export function assertNoDeniedPatterns(source: string): void {
  const lines = source.split('\n');
  for (const [label, regex] of DENY_PATTERNS) {
    for (let i = 0; i < lines.length; i += 1) {
      if (regex.test(lines[i])) {
        throw new Error(
          `[recipe-deny] denied pattern "${label}" matched at line ${i + 1}: ${lines[i].trim()}`
        );
      }
    }
  }
}
