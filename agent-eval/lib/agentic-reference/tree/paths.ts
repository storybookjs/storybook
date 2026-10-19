// Which files in a checked-out tree count as application source.
//
// Shared by the tree diff and the complexity baseline so the two can never
// disagree about what they are measuring.
//
// The vendored-directory rule is not hypothetical: Mealdrop checks in
// `.yarn/releases/yarn-4.2.1.cjs`, a 2MB minified bundle that alone accounted
// for 98% of the repository's total cyclomatic complexity (38951 of 39663).
// Nobody authored it and no agent will edit it.

/** Directories never worth walking: dependencies, build output, vendored tools. */
export const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.yarn',
  '.pnp',
  '.turbo',
  '.next',
  'dist',
  'build',
  'coverage',
  'vendor',
]);

/** Files whose contents are generated or minified rather than written. */
const GENERATED_FILE = /(?:\.min\.[cm]?jsx?|mockServiceWorker\.js)$/;

/**
 * Harness-injected files present in the collected tree that no agent authored.
 * Counting them would attribute several hundred lines of scaffolding to the run.
 */
export const EXCLUDED_PATHS = new Set([
  'EVAL.ts',
  'EVAL.tsx',
  'PROMPT.md',
  'post-analysis.ts',
  '.npmrc',
  'package.json',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'vitest.config.ts',
  'vitest.config.app.ts',
]);

const EXCLUDED_PREFIXES = ['__agent_eval__/', '__metrics__/', '__analysis__/'];

/** Extensions the SLoC diff measures. */
export const SOURCE_EXTENSIONS = /\.(?:tsx?|jsx?|mjs|cjs|css)$/;

/** Extensions with an AST the complexity walkers can read. */
export const SCRIPT_EXTENSIONS = /\.(?:tsx?|jsx?|mjs|cjs)$/;

export function isGenerated(path: string): boolean {
  return GENERATED_FILE.test(path);
}

/** Test files by naming convention: `*.test.*`, `*.spec.*`, or under `__tests__/`. */
const TEST_FILE = /\.(?:test|spec)\.[^/]+$/;

/**
 * Whether a path is test code rather than production code.
 *
 * Complexity metrics exclude these: an agent that volunteers a branchy
 * regression test alongside a two-line fix has not made the codebase harder to
 * maintain, and counting the test file said it had. Story files are demo
 * markup, not tests, and stay measured.
 */
export function isTestPath(path: string): boolean {
  if (TEST_FILE.test(path)) return true;
  return path.split('/').slice(0, -1).includes('__tests__');
}

/**
 * Whether a path lies inside a directory no walker descends into.
 *
 * Directory segments only, so a source file named after one — `src/build.ts` —
 * still counts. Every walker here applies SKIP_DIRS at each level as it
 * recurses, so this is the same rule read off a path instead of a dirent.
 */
function isUnderSkippedDir(path: string): boolean {
  return path
    .split('/')
    .slice(0, -1)
    .some((segment) => SKIP_DIRS.has(segment));
}

/**
 * Whether a workspace-relative path should be left out of every metric.
 *
 * The SKIP_DIRS check is redundant for callers that walked the tree themselves —
 * they never descended into those directories — and load-bearing for the one
 * that did not: the judge's diff comes from `git diff --no-index`, which walks
 * the trees itself, and an eval that builds the app leaves a `build/` the pinned
 * tree never had. Its bundles are .js and .css, so extension filtering alone
 * admits them, and a single minified chunk is larger than the judge's whole byte
 * budget.
 */
export function isExcludedPath(path: string): boolean {
  if (EXCLUDED_PATHS.has(path)) return true;
  if (EXCLUDED_PREFIXES.some((prefix) => path.startsWith(prefix))) return true;
  if (isUnderSkippedDir(path)) return true;
  return isGenerated(path);
}
