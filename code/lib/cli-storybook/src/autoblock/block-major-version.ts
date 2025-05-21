import { getStorybookVersionSpecifier } from 'storybook/internal/cli';
import { versions } from 'storybook/internal/common';

import picocolors from 'picocolors';
import { coerce, gt, major, parse, prerelease } from 'semver';
import { dedent } from 'ts-dedent';

import { createBlocker } from './types';

type UpgradeCheckResult = 'downgrade' | 'gap-too-large' | 'ok';

interface MajorVersionData {
  currentVersion: string;
  reason: Exclude<UpgradeCheckResult, 'ok'>;
}

/** Returns the status of the upgrade check */
export function checkUpgrade(currentVersion: string, targetVersion: string): UpgradeCheckResult {
  // Skip check for missing versions
  if (!currentVersion || !targetVersion) {
    return 'ok';
  }

  const current = parse(currentVersion);
  const target = parse(targetVersion);
  if (!current || !target) {
    return 'ok';
  }

  // Never block if upgrading from or to a prerelease
  if (prerelease(currentVersion) || prerelease(targetVersion)) {
    return 'ok';
  }

  // Never block if upgrading from or to version zero
  if (current.major === 0 || target.major === 0) {
    return 'ok';
  }

  // Check for downgrade (when current version is greater than target)
  if (gt(currentVersion, targetVersion)) {
    return 'downgrade';
  }

  // Check for version gap
  const gap = target.major - current.major;
  return gap > 1 ? 'gap-too-large' : 'ok';
}

export const blocker = createBlocker<MajorVersionData>({
  id: 'major-version-gap',
  async check(options) {
    const { packageManager } = options;

    const packageJson = await packageManager.retrievePackageJson();
    try {
      const current = getStorybookVersionSpecifier(packageJson);
      if (!current) {
        return false;
      }

      const target = versions.storybook;
      const result = checkUpgrade(current, target);
      if (result === 'ok') {
        return false;
      }

      return {
        currentVersion: current,
        reason: result,
      };
    } catch (e) {
      // If we can't determine the version, don't block
      return false;
    }
  },
  log(options, data) {
    const coercedVersion = coerce(data.currentVersion);

    if (data.reason === 'downgrade') {
      return dedent`
        ${picocolors.red('Downgrade Not Supported')}
        Your Storybook version (v${data.currentVersion}) is newer than the target release (v${versions.storybook}).
        Downgrading is not supported.

        For more information about upgrading and version compatibility, visit:
        ${picocolors.cyan('https://storybook.js.org/docs/configure/upgrading')}`;
    }

    const message = dedent`
      ${picocolors.red('Major Version Gap Detected')}
      Your Storybook version (v${data.currentVersion}) is more than one major version behind the target release (v${versions.storybook}).
      Please upgrade one major version at a time.`;

    if (coercedVersion) {
      const currentMajor = major(coercedVersion);
      const nextMajor = currentMajor + 1;
      const cmd = `npx storybook@${nextMajor} upgrade`;
      return dedent`
        ${message}

        You can upgrade to version ${nextMajor} by running:
        ${picocolors.cyan(cmd)}

        For more information about upgrading, visit:
        ${picocolors.cyan('https://storybook.js.org/docs/configure/upgrading')}`;
    }

    return dedent`
      ${message}

      For more information about upgrading, visit:
      ${picocolors.cyan('https://storybook.js.org/docs/configure/upgrading')}`;
  },
});
