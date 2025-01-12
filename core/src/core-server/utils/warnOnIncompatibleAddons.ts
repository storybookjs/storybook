import { logger } from '@storybook/core/node-logger';

import {
  getIncompatiblePackagesSummary,
  getIncompatibleStorybookPackages,
} from '../../../../lib/cli-storybook/src/doctor/getIncompatibleStorybookPackages';

export const warnOnIncompatibleAddons = async (currentStorybookVersion: string) => {
  const incompatiblePackagesList = await getIncompatibleStorybookPackages({
    skipUpgradeCheck: true,
    skipErrors: true,
    currentStorybookVersion,
  });

  const incompatiblePackagesMessage = await getIncompatiblePackagesSummary(
    incompatiblePackagesList,
    currentStorybookVersion
  );

  if (incompatiblePackagesMessage) {
    logger.warn(incompatiblePackagesMessage);
  }
};
