import type { ProjectType } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';

import { getAddonA11yDependencies } from '../addon-dependencies/addon-a11y';
import { getAddonVitestDependencies } from '../addon-dependencies/addon-vitest';
import type { DependencyCollector } from '../dependency-collector';

type DependencyInstallationCommandParams = {
  packageManager: JsPackageManager;
  skipInstall: boolean;
  projectType: ProjectType;
};

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
  constructor(private dependencyCollector: DependencyCollector) {}
  /** Execute dependency installation */
  async execute({
    packageManager,
    skipInstall = false,
    projectType,
  }: DependencyInstallationCommandParams): Promise<void> {
    await this.collectAddonDependencies(projectType, packageManager);

    if (!this.dependencyCollector.hasPackages() && skipInstall) {
      return;
    }

    try {
      const { dependencies, devDependencies } = this.dependencyCollector.getAllPackages();

      const task = prompt.taskLog({
        id: 'adding-dependencies',
        title: 'Adding dependencies to package.json',
      });

      if (dependencies.length > 0) {
        task.message('Adding dependencies:\n' + dependencies.map((dep) => `- ${dep}`).join('\n'));

        await packageManager.addDependencies(
          { type: 'dependencies', skipInstall: true },
          dependencies
        );
      }

      if (devDependencies.length > 0) {
        task.message(
          'Adding devDependencies:\n' + devDependencies.map((dep) => `- ${dep}`).join('\n')
        );

        await packageManager.addDependencies(
          { type: 'devDependencies', skipInstall: true },
          devDependencies
        );
      }

      task.success('Dependencies added to package.json', { showLog: true });

      if (!skipInstall && this.dependencyCollector.hasPackages()) {
        await packageManager.installDependencies();
      }
    } catch (err) {
      throw err;
    }
  }

  /** Collect addon dependencies without installing them */
  private async collectAddonDependencies(
    projectType: ProjectType,
    packageManager: JsPackageManager
  ): Promise<void> {
    try {
      // Determine framework package name for Next.js detection
      const frameworkPackageName = projectType === 'NEXTJS' ? '@storybook/nextjs' : undefined;

      const vitestDeps = await getAddonVitestDependencies(packageManager, frameworkPackageName);
      const a11yDeps = getAddonA11yDependencies();

      this.dependencyCollector.addDevDependencies([...vitestDeps, ...a11yDeps]);
    } catch (err) {
      logger.warn(`Failed to collect addon dependencies: ${err}`);
    }
  }
}

export const executeDependencyInstallation = (
  params: DependencyInstallationCommandParams & { dependencyCollector: DependencyCollector }
) => {
  return new DependencyInstallationCommand(params.dependencyCollector).execute(params);
};
