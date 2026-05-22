// Static deny-regex pass for agent-generated Playwright recipes.
// Pure function — no I/O. Throws on the first matched pattern, naming the
// pattern label and the (1-based) line number for actionable feedback.
//
// IMPORTANT — SECURITY MODEL:
// Deny-regex is a TRIPWIRE only — defence-in-depth, NOT the primary security
// boundary. The real boundary is the srt sandbox (Layer 2) + ESLint AST
// allowlist (.verify-recipes/.eslintrc.cjs). Regex matching alone is
// bypassable by obfuscation and is not relied upon for safety.
//
// Order: recipe-deny runs BEFORE the ESLint pass so the cheapest structural
// regex catches the obvious cases and produces actionable feedback before
// the slower AST traversal kicks in.

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
  ['from node: (named import)', /\bfrom\s+['"`]node:(fs|child_process|net|dns|http|https)['"`]/],
  ['require(node:)', /\brequire\s*\(\s*['"`]node:/],
  ['require(child_process)', /\brequire\s*\(\s*['"`]child_process/],
  // C6 extension: dynamic import + obfuscation paths. ESLint catches these
  // structurally; the regex pass surfaces them earlier with a line number.
  ['dynamic import(', /\bimport\s*\(/],
  ['from node: (any module)', /\bfrom\s+['"`]node:/],
  ['createRequire', /\bcreateRequire\b/],
  ['process.mainModule', /\bprocess\.mainModule\b/],
  ['process.binding', /\bprocess\.binding\b/],
  ['globalThis[', /\bglobalThis\s*\[/],
  // Recipes must import `test` + `expect` from `./_util.ts` (which re-exports
  // them, augmented with the auto-failure-capture fixture). Importing from
  // `@playwright/test` directly bypasses the fixture and loses the iframe
  // snapshot on failure.
  ['import @playwright/test', /\bfrom\s+['"`]@playwright\/test['"`]/],
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
