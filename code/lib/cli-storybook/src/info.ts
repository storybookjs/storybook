import {
  HandledError,
  JsPackageManagerFactory,
  PackageManagerName,
  getRemotePackageRunnerArgs,
} from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import picocolors from 'picocolors';

const ENVINFO_VERSION = '7.14.0';
const STORYBOOK_PACKAGES = '{@storybook/*,*storybook*,sb,chromatic}';

export async function info() {
  logger.log(picocolors.bold('\nStorybook Environment Info:'));
  const packageManager = JsPackageManagerFactory.getPackageManager();
  const activePackageManager = packageManager.type.replace(/\d/, ''); // 'yarn1' -> 'yarn'
  // Run on demand: it is the largest dependency of the CLI, and only this command needs it.
  const { stdout } = await packageManager
    .runPackageCommand({
      args: [
        // `yarn dlx` prints its install log to stdout.
        ...(packageManager.type === PackageManagerName.YARN2 ? ['--quiet'] : []),
        ...getRemotePackageRunnerArgs(packageManager.type, 'envinfo', ENVINFO_VERSION, [
          '--raw',
          JSON.stringify({
            System: ['OS', 'CPU', 'Shell'],
            Binaries: ['Node', 'Yarn', 'npm', 'pnpm'],
            Browsers: ['Chrome', 'Edge', 'Firefox', 'Safari'],
            npmPackages: STORYBOOK_PACKAGES,
            npmGlobalPackages: STORYBOOK_PACKAGES,
          }),
        ]),
      ],
      useRemotePkg: true,
      stdio: 'pipe',
    })
    .catch((error) => {
      logger.error(
        `Could not run envinfo ${ENVINFO_VERSION}. This command downloads it from the npm registry.\n${String(error)}`
      );
      throw new HandledError(error);
    });
  const output = String(stdout);
  const [activeLine] = output.match(new RegExp(`${activePackageManager}:.*`, 'i')) ?? [];
  logger.log(
    activeLine ? output.replace(activeLine, picocolors.bold(`${activeLine} <----- active`)) : output
  );
}
