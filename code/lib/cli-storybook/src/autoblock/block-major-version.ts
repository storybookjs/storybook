import { versions } from 'storybook/internal/common';
import { CLI_COLORS } from 'storybook/internal/node-logger';

import { coerce, major, parse } from 'semver';
import { dedent } from 'ts-dedent';

import { createBlocker } from './types.ts';

type UpgradeCheckResult = 'gap-too-large' | 'ok';

interface MajorVersionData {
  currentVersion: string;
  reason: Exclude<UpgradeCheckResult, 'ok'>;
}

/** Returns the status of the upgrade check */
export function validateVersionTransition(
  currentVersion: string,
  targetVersion: string
): UpgradeCheckResult {
  // Skip check for missing versions
  if (!currentVersion || !targetVersion) {
    return 'ok';
  }

  const current = parse(currentVersion);
  const target = parse(targetVersion);
  if (!current || !target) {
    return 'ok';
  }

  // Never block if upgrading from or to version zero
  if (current.major === 0 || target.major === 0) {
    return 'ok';
  }

  // A downgrade is not checked here: the upgrade rejects it before the blockers run, except for
  // canaries, where it is allowed on purpose.
  const gap = target.major - current.major;
  return gap > 1 ? 'gap-too-large' : 'ok';
}

export const blocker = createBlocker<MajorVersionData>({
  id: 'major-version-gap',
  async check(options) {
    const { packageManager } = options;
    try {
      // The installed version, as the upgrade itself uses: the range in package.json
      // (e.g. `^8.6.15`) is not a version, so it would never be compared.
      const currentStorybookVersion = (await packageManager.getModulePackageJSON('storybook'))
        ?.version;
      if (!currentStorybookVersion) {
        return false;
      }

      const target = versions.storybook;
      const result = validateVersionTransition(currentStorybookVersion, target);
      if (result === 'ok') {
        return false;
      }

      return {
        currentVersion: currentStorybookVersion,
        reason: result,
      };
    } catch (e) {
      // If we can't determine the version, don't block
      return false;
    }
  },
  log(data) {
    const coercedVersion = coerce(data.currentVersion);

    if (coercedVersion) {
      const currentMajor = major(coercedVersion);
      const nextMajor = currentMajor + 1;
      return {
        title: 'Major Version Gap Detected',
        message: dedent`
          Your Storybook version (v${data.currentVersion}) is more than one major version behind the target release (v${versions.storybook}). Please upgrade one major version at a time.
          
          You can upgrade to version ${nextMajor} by running:
          ${CLI_COLORS.info(`npx storybook@${nextMajor} upgrade`)}
        `,
        link: `https://storybook.js.org/docs/${nextMajor}/migration-guide?ref=upgrade`,
      };
    }

    throw new Error('No message found');
  },
});
