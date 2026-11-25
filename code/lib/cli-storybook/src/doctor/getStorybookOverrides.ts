import {
  type JsPackageManager,
  type Overrides,
  getProjectRelativePath,
  isCorePackage,
} from 'storybook/internal/common';

import semver from 'semver';
import { dedent } from 'ts-dedent';

import { isCanaryVersion } from '../util.ts';

/** An override that pins a Storybook package outside the target version. */
export interface StorybookOverride {
  /** File declaring the override. */
  path: string;
  /** Field and keys leading to the entry. */
  keyPath: string[];
  /** Range the override forces. */
  range: string;
}

export const STORYBOOK_OVERRIDES_TITLE = 'Overrides pin Storybook packages to another version';

const KEY_PATH_SEPARATOR = ' › ';

/** Lists the overrides known to the package manager whose range excludes `targetVersion`. */
export function getStorybookOverrides({
  packageManager,
  targetVersion,
}: {
  packageManager: JsPackageManager;
  targetVersion: string;
}): StorybookOverride[] {
  // No user range is expected to match a canary or linked build.
  if (isCanaryVersion(targetVersion)) {
    return [];
  }

  return packageManager
    .getOverrideSources()
    .flatMap(({ path, field, overrides }) => collectStorybookOverrides(path, overrides, [field]))
    .filter(({ range }) => excludesVersion(range, targetVersion));
}

/**
 * Describes the overrides and what to do about them.
 *
 * @example
 *
 * ```text
 * These overrides force Storybook packages to versions that exclude 11.0.0:
 *
 * - /package.json: overrides › @storybook/addon-mcp › storybook = ~10.5.3
 *
 * Update these entries to 11.0.0 or remove them, then reinstall your dependencies.
 * ```
 */
export function getStorybookOverridesSummary(
  overrides: StorybookOverride[],
  targetVersion: string,
  nextStep?: string
): string {
  const list = overrides
    .map(
      ({ path, keyPath, range }) =>
        `- ${getProjectRelativePath(path)}: ${keyPath.join(KEY_PATH_SEPARATOR)} = ${range}`
    )
    .join('\n');

  return dedent`
    These overrides force Storybook packages to versions that exclude ${targetVersion}:

    ${list}

    Update these entries to ${targetVersion} or remove them${nextStep ? `, then ${nextStep}` : ''}.
  `;
}

/** Walks override entries, where npm scopes nested entries to a parent and `.` overrides that parent. */
function collectStorybookOverrides(
  path: string,
  overrides: Overrides,
  keyPath: string[],
  parent?: string
): StorybookOverride[] {
  return Object.entries(overrides).flatMap(([key, value]): StorybookOverride[] => {
    const entryPath = [...keyPath, key];
    if (typeof value !== 'string') {
      return collectStorybookOverrides(path, value, entryPath, key);
    }
    const selector = key === '.' ? parent : key;
    // A top-level `.` names no package.
    if (selector === undefined) {
      return [];
    }
    const packageName = getOverriddenPackageName(selector);
    return packageName && isCorePackage(packageName)
      ? [{ path, keyPath: entryPath, range: value }]
      : [];
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
