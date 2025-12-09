import type { JsPackageManager } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import {
  getIncompatiblePackagesSummary,
  getIncompatibleStorybookPackages,
} from '../../../../lib/cli-storybook/src/doctor/getIncompatibleStorybookPackages';

export const warnOnIncompatibleAddons = async (
  currentStorybookVersion: string,
  packageManager: JsPackageManager
) => {
  const incompatiblePackagesList = await getIncompatibleStorybookPackages({
    skipUpgradeCheck: true,
    skipErrors: true,
    currentStorybookVersion,
    packageManager,
  });

  const incompatiblePackagesMessage = getIncompatiblePackagesSummary(
    incompatiblePackagesList,
    currentStorybookVersion
  );

  if (incompatiblePackagesMessage) {
    logger.warn(incompatiblePackagesMessage);
  }
};
