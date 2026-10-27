import semver from 'semver';

/**
 * Whether an upgrade crosses the version that introduced something.
 *
 * Versions are coerced so a prerelease counts as reaching the release: `>=10.5.0` does not match
 * `10.5.0-rc.1` in semver, even with `includePrerelease`. Without coercion an RC user is skipped on
 * the crossing upgrade and then skipped again on the stable one, because by then their
 * before-version is already past the boundary.
 */
export const crossesVersionBoundary = (
  beforeVersion: string,
  targetVersion: string,
  introducedIn: string
): boolean => {
  const before = semver.coerce(beforeVersion);
  const target = semver.coerce(targetVersion);
  if (!before || !target) {
    return false;
  }
  return semver.lt(before, introducedIn) && semver.gte(target, introducedIn);
};

export const isAtOrPastVersion = (version: string, introducedIn: string): boolean => {
  const coerced = semver.coerce(version);
  return coerced !== null && semver.gte(coerced, introducedIn);
};
