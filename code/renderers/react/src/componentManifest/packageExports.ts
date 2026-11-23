import { defaultResolveConditionNames } from 'storybook/internal/common';

import path from 'pathe';

type ExportsMap = Record<string, unknown>;

// Node's PACKAGE_TARGET_RESOLVE: the file a target gives under `conditions`, `null` when the
// target excludes the subpath, `undefined` when no condition applies.
function resolveTarget(
  target: unknown,
  patternMatch: string | undefined,
  conditions: readonly string[]
): string | null | undefined {
  if (typeof target === 'string') {
    return patternMatch === undefined ? target : target.replaceAll('*', patternMatch);
  }
  if (target === null) {
    return null;
  }
  if (Array.isArray(target)) {
    for (const fallback of target) {
      const resolved = resolveTarget(fallback, patternMatch, conditions);
      if (resolved !== undefined) {
        return resolved;
      }
    }
    return undefined;
  }
  if (typeof target === 'object') {
    for (const [condition, value] of Object.entries(target)) {
      if (condition === 'default' || conditions.includes(condition)) {
        const resolved = resolveTarget(value, patternMatch, conditions);
        if (resolved !== undefined) {
          return resolved;
        }
      }
    }
  }
  return undefined;
}

// Node's PACKAGE_EXPORTS_RESOLVE for a subpath such as `./button`: an exact key wins, then the
// pattern key with the longest prefix.
export function resolveExportSubpath(
  exportsMap: ExportsMap,
  subpath: string,
  conditions: readonly string[] = defaultResolveConditionNames
): string | null | undefined {
  if (!subpath.includes('*') && Object.hasOwn(exportsMap, subpath)) {
    return resolveTarget(exportsMap[subpath], undefined, conditions);
  }

  const patternKeys = Object.keys(exportsMap)
    .filter((key) => key.split('*').length === 2)
    .sort((a, b) => b.indexOf('*') - a.indexOf('*') || b.length - a.length);
  for (const key of patternKeys) {
    const [base, trailer] = key.split('*');
    if (
      subpath.startsWith(base) &&
      subpath !== base &&
      (trailer === '' || (subpath.endsWith(trailer) && subpath.length >= key.length))
    ) {
      const patternMatch = subpath.slice(base.length, subpath.length - trailer.length);
      return resolveTarget(exportsMap[key], patternMatch, conditions);
    }
  }
  return undefined;
}

// Every string a target lists, through condition objects and fallback arrays.
function listTargets(target: unknown): string[] {
  if (typeof target === 'string') {
    return [target];
  }
  if (Array.isArray(target)) {
    return target.flatMap(listTargets);
  }
  if (typeof target === 'object' && target !== null) {
    return Object.values(target).flatMap(listTargets);
  }
  return [];
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The subpath `key` would give for `file` through `target`, if `target` can produce `file`.
function matchTarget(key: string, target: string, root: string, file: string) {
  if (!key.includes('*')) {
    return path.resolve(root, target) === file ? key : undefined;
  }
  const relativeFile = `./${path.relative(root, file)}`;
  const [first, ...rest] = target.split('*').map(escapeRegExp);
  const pattern = new RegExp(`^${first}(.+)${rest.join('\\1')}$`);
  const patternMatch = pattern.exec(relativeFile)?.[1];
  return patternMatch === undefined ? undefined : key.replace('*', patternMatch);
}

/**
 * The `exports` subpath a consumer imports `file` from, such as `./button`. A subpath only counts
 * when resolving it under `conditions` gives back `file`, so excluded subpaths, `require`-only
 * targets and keys that a more specific key shadows are skipped.
 */
export function findExportSubpath(
  exportsMap: ExportsMap,
  root: string,
  file: string,
  conditions: readonly string[] = defaultResolveConditionNames
): string | undefined {
  for (const [key, target] of Object.entries(exportsMap)) {
    for (const candidate of listTargets(target)) {
      const subpath = matchTarget(key, candidate, root, file);
      if (subpath === undefined) {
        continue;
      }
      const resolved = resolveExportSubpath(exportsMap, subpath, conditions);
      if (typeof resolved === 'string' && path.resolve(root, resolved) === file) {
        return subpath;
      }
    }
  }
  return undefined;
}
