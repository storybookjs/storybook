import type { PrContext } from '../../types.ts';

const ENTRY_HEADER = /^([+\-])"([^"]+)":\s*$/;
const NAME = /^(@?[^@,]+)@/;

/**
 * Result of comparing yarn.lock additions against removals in a PR's diff.
 *
 * - `added` and `removed` are name-only and deduped within their set.
 * - Version bumps (same package name appearing in both sides because its
 *   resolution changed) are filtered out from BOTH sets — they're "modified",
 *   not "added" or "removed", and shouldn't bias the cost/benefit signal.
 * - `delta` is the net change in distinct dependency names. Positive = more
 *   maintenance surface; negative = the PR is shedding deps (often a win,
 *   e.g., a cleanup or security improvement).
 */
export interface DependencyDiff {
  added: string[];
  removed: string[];
  delta: number;
}

/**
 * Dependency-changes precompute for Check 4 (cost/benefit).
 *
 * Reports newly-added AND newly-removed packages by name. Storybook is
 * unusual: devDependencies are runtime concerns because many of them get
 * pre-bundled — so we don't split runtime / dev / peer. Check 4 weighs the
 * combined surface.
 *
 * Parses yarn.lock rather than package.json because the lockfile is the
 * authoritative resolved-dependency record: a PR that updates a transitive
 * dep does so by changing a resolution entry, and yarn.lock captures that
 * uniformly across direct and transitive changes.
 */
export function computeDependencyDiff(files: PrContext['files']): DependencyDiff {
  const lockFile = files.find((f) => f.path === 'yarn.lock' || f.path.endsWith('/yarn.lock'));
  // GitHub omits `patch` on binary or oversized files; nothing to parse.
  if (!lockFile?.patch) return { added: [], removed: [], delta: 0 };

  const added = new Set<string>();
  const removed = new Set<string>();

  for (const line of lockFile.patch.split('\n')) {
    const headerMatch = ENTRY_HEADER.exec(line);
    if (!headerMatch) continue;
    const sign = headerMatch[1];
    const firstKey = headerMatch[2].split(',')[0].trim();
    const nameMatch = NAME.exec(firstKey);
    if (!nameMatch) continue;
    (sign === '+' ? added : removed).add(nameMatch[1]);
  }

  // Filter out version bumps: same package name in both sides means the
  // resolution was updated, not that the dep was actually added or removed.
  for (const name of [...added]) {
    if (removed.has(name)) {
      added.delete(name);
      removed.delete(name);
    }
  }

  const addedArr = [...added];
  const removedArr = [...removed];
  return {
    added: addedArr,
    removed: removedArr,
    delta: addedArr.length - removedArr.length,
  };
}
