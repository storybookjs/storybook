import semver from 'semver';

import type { Fix } from '../types';

/**
 * Checks if a fix should be applied based on version range
 *
 * @param fix - The fix to check
 * @param beforeVersion - The version before upgrade
 * @param afterVersion - The version after upgrade
 * @param isUpgrade - Whether this is an upgrade
 * @returns True if the fix should be applied
 */
export function shouldRunFix(
  fix: Fix,
  beforeVersion: string,
  afterVersion: string,
  isUpgrade: boolean
): boolean {
  if (!isUpgrade) {
    return true;
  }

  if (!fix.versionRange) {
    return true;
  }

  const [fromVersion, toVersion] = fix.versionRange;
  return (
    semver.satisfies(beforeVersion, fromVersion, { includePrerelease: true }) &&
    semver.satisfies(afterVersion, toVersion, { includePrerelease: true })
  );
}
