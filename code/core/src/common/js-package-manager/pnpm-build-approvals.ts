import { readFileSync } from 'node:fs';
import { resolve } from 'pathe';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Matches a package name, including pinned versions of that package.
 * For instance, if `value` is `esbuild@0.25.0 || 0.25.1`, it matches `pkg` `esbuild`.
 * @param value The package name or pinned version to match against.
 * @param pkg The package name to check against the value.
 * @returns whether the package matches the given value.
 */
export const matchesPackage = (value: unknown, pkg: string): boolean =>
  typeof value === 'string' && (value === pkg || value.startsWith(`${pkg}@`));

/**
 * Checks if a list of packages matches a given package name, including if the
 * list contains pinned versions of that package.
 * @param list List of package names to check.
 * @param pkg The package name to check against the list of matchers.
 * @returns whether the package matches any of the entries in the list.
 */
export const listsPackage = (list: unknown, pkg: string): boolean =>
  Array.isArray(list) && list.some((value) => matchesPackage(value, pkg));

/**
 * Checks if PNPM settings contain an `allowBuilds` decision for the given package.
 * Does not check whether it's allowed or refused, we only care to not modify `allowBuilds`
 * when a pre-existing user decision exists.
 *
 * Note however that PNPM 12 inserts placeholder keys in `allowBuilds` for package names
 * where the user has not made a decision. This does not happen for pinned versions but
 * only for exact matches. So we verify we do have a boolean value for exact matches.
 *
 * @param settings The PNPM settings object to check.
 * @param pkg The package name to check for an `allowBuilds` decision.
 * @returns `true` if there is an existing `allowBuilds` decision for the package, `false` otherwise.
 */
export function hasAllowBuildsDecision(settings: unknown, pkg: string): boolean {
  if (!isRecord(settings)) {
    return false;
  }

  if (settings.dangerouslyAllowAllBuilds === true) {
    return true;
  }

  const { allowBuilds } = settings;
  return (
    isRecord(allowBuilds) &&
    Object.keys(allowBuilds).some(
      (matcher) => matchesPackage(matcher, pkg) && typeof allowBuilds[matcher] === 'boolean'
    )
  );
}

/**
 * Reads an existing `onlyBuiltDependenciesFile` and returns its contents as an array of package names or pins.
 * @param file The path to the `onlyBuiltDependenciesFile`.
 * @param dir The directory containing the `onlyBuiltDependenciesFile`.
 * @returns An array of package names listed in the file, or an empty array if the file does not exist or is invalid.
 */
export function readOnlyBuiltDependenciesFile(file: unknown, dir: string): unknown[] {
  if (typeof file !== 'string') {
    return [];
  }
  try {
    const list = JSON.parse(readFileSync(resolve(dir, file), 'utf8'));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * Checks whether there is any user setting that indicates we cannot decide for them to
 * preallow a package. This can be because they made an explicit decision, or because us
 * setting `allowBuilds` in a `pnpm-workspace.yaml` file would lead to invalid config
 * or unwanted side effects.
 * @param settings The PNPM settings object to check.
 * @param pkg The package name to check for an existing decision.
 * @param dir The directory containing the `onlyBuiltDependenciesFile`.
 * @returns `true` if there is an existing decision that prevents preallowing the package, `false` otherwise.
 */
export function hasPnpm10ListDecision(settings: unknown, pkg: string, dir: string): boolean {
  if (!isRecord(settings)) {
    return false;
  }
  return (
    // pnpm 10 refuses to combine `neverBuiltDependencies` with any allow list,
    // so its presence alone is a decision.
    Array.isArray(settings.neverBuiltDependencies) ||
    listsPackage(settings.onlyBuiltDependencies, pkg) ||
    listsPackage(settings.ignoredBuiltDependencies, pkg) ||
    listsPackage(readOnlyBuiltDependenciesFile(settings.onlyBuiltDependenciesFile, dir), pkg)
  );
}
