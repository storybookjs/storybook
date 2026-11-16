import { JsPackageManager, isCorePackage } from 'storybook/internal/common';

import semver from 'semver';
import { dedent } from 'ts-dedent';

import { isCanaryVersion, shortenPath } from '../util.ts';

/** A Storybook package override found in a package.json field. */
type StorybookOverride = {
  /** Field and keys leading to the entry. */
  keyPath: string[];
  /** Range the override forces. */
  range: string;
};

export const STORYBOOK_OVERRIDES_TITLE = 'Overrides pin Storybook packages to another version';

const KEY_PATH_SEPARATOR = ' › ';

/**
 * Describes the `overrides`, `resolutions` and `pnpm.overrides` entries, across the project's
 * package.json files, whose range excludes `targetVersion`. Returns `undefined` when there are none.
 *
 * @example
 *
 * ```text
 * These package.json overrides force Storybook packages to versions that exclude 11.0.0:
 *
 * - /package.json: overrides › @storybook/addon-mcp › storybook = ~10.5.3
 *
 * Update these entries to 11.0.0 or remove them.
 * ```
 */
export function getStorybookOverridesSummary({
  packageManager,
  targetVersion,
}: {
  packageManager: JsPackageManager;
  targetVersion: string;
}): string | undefined {
  // No user range is expected to match a canary or linked build.
  if (isCanaryVersion(targetVersion)) {
    return undefined;
  }

  const lines = packageManager.packageJsonPaths.flatMap((packageJsonPath) => {
    const packageJson = JsPackageManager.getPackageJson(packageJsonPath);
    return [
      ...collectStorybookOverrides(packageJson.overrides, ['overrides'], undefined),
      ...collectStorybookOverrides(packageJson.resolutions, ['resolutions'], undefined),
      ...collectStorybookOverrides(packageJson.pnpm?.overrides, ['pnpm.overrides'], undefined),
    ]
      .filter(({ range }) => excludesVersion(range, targetVersion))
      .map(
        ({ keyPath, range }) =>
          `- ${shortenPath(packageJsonPath)}: ${keyPath.join(KEY_PATH_SEPARATOR)} = ${range}`
      );
  });

  if (lines.length === 0) {
    return undefined;
  }

  return dedent`
    These package.json overrides force Storybook packages to versions that exclude ${targetVersion}:

    ${lines.join('\n')}

    Update these entries to ${targetVersion} or remove them.
  `;
}

/**
 * Walks an override field, where an object value scopes its entries to the package `selector`
 * names, and its `.` key overrides that package.
 */
function collectStorybookOverrides(
  node: unknown,
  keyPath: string[],
  selector: string | undefined
): StorybookOverride[] {
  if (typeof node !== 'object' || node === null) {
    return [];
  }

  return Object.entries(node).flatMap(([key, value]): StorybookOverride[] => {
    const entryPath = [...keyPath, key];
    if (typeof value !== 'string') {
      return collectStorybookOverrides(value, entryPath, key);
    }
    // A top-level `.` has no package to override.
    const entrySelector = key === '.' ? selector : key;
    const packageName =
      entrySelector === undefined ? undefined : getOverriddenPackageName(entrySelector);
    return packageName && isCorePackage(packageName) ? [{ keyPath: entryPath, range: value }] : [];
  });
}

/**
 * Returns the package an override applies to, or `undefined` when the selector carries a version,
 * since such an override stops matching once the dependency is upgraded.
 *
 * @example
 *
 * ```ts
 * getOverriddenPackageName('@storybook/addon-mcp/storybook'); // 'storybook'
 * getOverriddenPackageName('parent/@storybook/addon-vitest'); // '@storybook/addon-vitest'
 * getOverriddenPackageName('@storybook/addon-mcp>storybook'); // 'storybook'
 * getOverriddenPackageName('storybook@^10'); // undefined
 * ```
 */
function getOverriddenPackageName(selector: string): string | undefined {
  const target = selector.split('>').at(-1) ?? '';
  const segments = target.split('/');
  const last = segments.at(-1) ?? '';
  const scope = segments.at(-2);
  const name = scope?.startsWith('@') ? `${scope}/${last}` : last;

  return name.lastIndexOf('@') > 0 ? undefined : name;
}

function excludesVersion(range: string, version: string): boolean {
  const semverRange = range.startsWith('npm:') ? range.slice('npm:'.length) : range;
  // `satisfies` is also false for values that are not ranges (`$ref`, `-`, aliases, protocols).
  return (
    semver.validRange(semverRange) !== null &&
    !semver.satisfies(version, semverRange, { includePrerelease: true })
  );
}
