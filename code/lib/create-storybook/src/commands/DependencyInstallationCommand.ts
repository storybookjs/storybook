import type { JsPackageManager } from 'storybook/internal/common';

import type { DependencyCollector } from '../dependency-collector';

/**
 * Command for installing all collected dependencies
 *
 * Responsibilities:
 *
 * - Update package.json with all dependencies
 * - Run single installation operation
 * - Handle skipInstall option
 */
export class DependencyInstallationCommand {
  /** Execute dependency installation */
  async execute(
    packageManager: JsPackageManager,
    dependencyCollector: DependencyCollector,
    skipInstall: boolean = false
  ): Promise<void> {
    if (!dependencyCollector.hasPackages() && skipInstall) {
      return;
    }

    try {
      const { dependencies, devDependencies } = dependencyCollector.getAllPackages();

      if (dependencies.length > 0) {
        await packageManager.addDependencies(
          { type: 'dependencies', skipInstall: true },
          dependencies
        );
      }

      if (devDependencies.length > 0) {
        await packageManager.addDependencies(
          { type: 'devDependencies', skipInstall: true },
          devDependencies
        );
      }

      if (!skipInstall && dependencyCollector.hasPackages()) {
        await packageManager.installDependencies();
      }
    } catch (err) {
      throw err;
    }
  }
}

export const executeDependencyInstallation = (
  packageManager: JsPackageManager,
  dependencyCollector: DependencyCollector,
  skipInstall: boolean = false
) => {
  return new DependencyInstallationCommand().execute(
    packageManager,
    dependencyCollector,
    skipInstall
  );
};
