import type { PrContext } from '../../types.ts';

const ENTRY_HEADER = /^\+"([^"]+)":\s*$/;
const NAME = /^(@?[^@,]+)@/;

/**
 * Dependency-additions precompute for Check 4 (cost/benefit).
 *
 * Reports every newly-added package in the PR's yarn.lock by name (scoped or
 * not). Storybook is unusual: devDependencies are runtime concerns because
 * many of them get pre-bundled — so we don't split runtime / dev / peer;
 * Check 4 weighs the combined surface.
 *
 * We parse yarn.lock additions rather than package.json adds because the
 * lockfile is the authoritative resolved-dependency record: a PR that changes
 * a transitive dep does so by adding a new resolution entry, and yarn.lock
 * captures that uniformly across direct and transitive changes. Counting
 * top-level additions in the lockfile is therefore a single signal that
 * subsumes "new direct dep" and "new version of a transitive dep".
 */
export function computeAddedDependencies(files: PrContext['files']): string[] {
  const lockFile = files.find((f) => f.path === 'yarn.lock' || f.path.endsWith('/yarn.lock'));
  // GitHub omits `patch` on binary or oversized files; nothing to parse.
  if (!lockFile?.patch) return [];

  const names = lockFile.patch
    .split('\n')
    .map((line) => ENTRY_HEADER.exec(line)?.[1])
    .filter((key): key is string => key != null)
    .map((key) => NAME.exec(key.split(',')[0].trim())?.[1])
    .filter((name): name is string => name != null);

  return Array.from(new Set(names));
}
