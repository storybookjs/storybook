import { detectPnp } from 'storybook/internal/cli';
import {
  type JsPackageManager,
  JsPackageManagerFactory,
  invalidateProjectRootCache,
} from 'storybook/internal/common';
import { CLI_COLORS, deprecate, logger } from 'storybook/internal/node-logger';

import dedent from 'ts-dedent';

import type { CommandOptions } from '../generators/types';
import { currentDirectoryIsEmpty, scaffoldNewProject } from '../scaffold-new-project';
import { VersionService } from '../services';

export interface PreflightCheckResult {
  packageManager: JsPackageManager;
  isEmptyProject: boolean;
}

/**
 * Command for running preflight checks before Storybook initialization
 *
 * Responsibilities:
 *
 * - Handle empty directory detection and scaffolding
 * - Initialize package manager
 * - Install base dependencies if needed
 */
export class PreflightCheckCommand {
  /** Execute preflight checks */
  constructor(private readonly versionService = new VersionService()) {}
  async execute(options: CommandOptions): Promise<PreflightCheckResult> {
    const { packageManager: pkgMgr, force } = options;

    const isEmptyDirProject = force !== true && currentDirectoryIsEmpty();
    let packageManagerType = JsPackageManagerFactory.getPackageManagerType();

    // Check if the current directory is empty
    if (isEmptyDirProject) {
      // Initializing Storybook in an empty directory with yarn1
      // will very likely fail due to different kinds of hoisting issues
      // which doesn't get fixed anymore in yarn1.
      // We will fallback to npm in this case.
      if (packageManagerType === 'yarn1') {
        packageManagerType = 'npm';
      }

      // Prompt the user to create a new project from our list
      logger.intro(CLI_COLORS.info(`Initializing a new project`));
      await scaffoldNewProject(packageManagerType, options);
      logger.outro(CLI_COLORS.info(`Project created successfully`));
      invalidateProjectRootCache();
    }

    logger.intro(CLI_COLORS.info(`Initializing Storybook`));

    const packageManager = JsPackageManagerFactory.getPackageManager({
      force: pkgMgr,
    });

    // Install base project dependencies if we scaffolded a new project
    if (isEmptyDirProject && !options.skipInstall) {
      await packageManager.installDependencies();
    }

    const pnp = await detectPnp();
    if (pnp) {
      deprecate(dedent`
        As of Storybook 10.0, PnP is deprecated. 
        If you are using PnP, you can continue to use Storybook 10.0, but we recommend migrating to a different package manager or linker-mode. In future versions, PnP compatibility will be removed.
    `);
    }

    await this.displayVersionInfo(packageManager);

    return { packageManager, isEmptyProject: isEmptyDirProject };
  }

  /** Display version information and warnings */
  private async displayVersionInfo(packageManager: JsPackageManager): Promise<void> {
    const { currentVersion, latestVersion, isPrerelease, isOutdated } =
      await this.versionService.getVersionInfo(packageManager);

    if (isOutdated && !isPrerelease) {
      logger.warn(dedent`
          This version is behind the latest release, which is: ${latestVersion}!
          You likely ran the init command through npx, which can use a locally cached version.
          
          To get the latest, please run: ${CLI_COLORS.cta('npx storybook@latest init')}
          You may want to ${CLI_COLORS.cta('CTRL+C')} to stop, and run with the latest version instead.
        `);
    } else if (isPrerelease) {
      logger.warn(`This is a pre-release version: ${currentVersion}`);
    } else {
      logger.info(`Adding Storybook version ${currentVersion} to your project`);
    }
  }
}

export const executePreflightCheck = async (
  options: CommandOptions
): Promise<PreflightCheckResult> => {
  const command = new PreflightCheckCommand();
  return command.execute(options);
};
