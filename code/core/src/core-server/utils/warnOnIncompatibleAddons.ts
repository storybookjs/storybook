import { logger } from '@storybook/core/node-logger';
import {
  getIncompatibleStorybookPackages,
  getIncompatiblePackagesSummary,
} from '../../../../lib/cli/src/doctor/getIncompatibleStorybookPackages';

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
