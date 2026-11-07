import { JsPackageManagerFactory } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import picocolors from 'picocolors';

import { getMismatchingVersionsWarnings } from '../../../../lib/cli-storybook/src/doctor/getMismatchingVersionsWarning.ts';

export const warnOnMismatchingVersions = async (configDir: string) => {
  try {
    const packageManager = JsPackageManagerFactory.getPackageManager({ configDir });
    const installationMetadata = await packageManager.findInstallations([
      '@storybook/*',
      'storybook',
    ]);
    const mismatchingVersionsMessage = getMismatchingVersionsWarnings(installationMetadata);

    if (mismatchingVersionsMessage) {
      logger.warn(
        `${mismatchingVersionsMessage}\n\nRun ${picocolors.cyan('npx storybook doctor')} for a full diagnosis.`
      );
    }
  } catch (e) {
    logger.debug(`Storybook failed to check package versions: ${String(e)}`);
  }
};
