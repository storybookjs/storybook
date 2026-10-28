import type { JsPackageManager } from '@storybook/core/internal/common';
import { logger } from '@storybook/core/internal/node-logger';

import {
  getIncompatiblePackagesSummary,
  getIncompatibleStorybookPackages,
} from '../../../../../cli-storybook/src/doctor/getIncompatibleStorybookPackages.ts';

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
