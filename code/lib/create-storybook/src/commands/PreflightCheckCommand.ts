import {
  type JsPackageManager,
  JsPackageManagerFactory,
  invalidateProjectRootCache,
} from 'storybook/internal/common';

import type { CommandOptions } from '../generators/types';
import { currentDirectoryIsEmpty, scaffoldNewProject } from '../scaffold-new-project';

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
      await scaffoldNewProject(packageManagerType, options);
      invalidateProjectRootCache();
    }

    const packageManager = JsPackageManagerFactory.getPackageManager({
      force: pkgMgr,
    });

    // Install base project dependencies if we scaffolded a new project
    if (isEmptyDirProject && !options.skipInstall) {
      await packageManager.installDependencies();
    }

    return { packageManager, isEmptyProject: isEmptyDirProject };
  }
}
