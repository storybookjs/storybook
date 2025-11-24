import { AddonVitestService } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';
import { ErrorCollector } from 'storybook/internal/telemetry';
import { Feature } from 'storybook/internal/types';

import type { DependencyCollector } from '../dependency-collector';

type DependencyInstallationCommandParams = {
  packageManager: JsPackageManager;
  skipInstall: boolean;
  selectedFeatures: Set<Feature>;
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
  constructor(
    private dependencyCollector: DependencyCollector,
    private addonVitestService = new AddonVitestService()
  ) {}
  /** Execute dependency installation */
  async execute({
    packageManager,
    skipInstall = false,
    selectedFeatures,
  }: DependencyInstallationCommandParams): Promise<{ status: 'success' | 'failed' }> {
    await this.collectAddonDependencies(packageManager, selectedFeatures);

    if (!this.dependencyCollector.hasPackages() && skipInstall) {
      return { status: 'success' };
    }

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
      try {
        await packageManager.installDependencies();
      } catch (err) {
        ErrorCollector.addError(err);
        return { status: 'failed' };
      }
    }

    return { status: 'success' };
  }

  /** Collect addon dependencies without installing them */
  private async collectAddonDependencies(
    packageManager: JsPackageManager,
    selectedFeatures: Set<Feature>
  ): Promise<void> {
    try {
      if (selectedFeatures.has(Feature.TEST)) {
        const vitestDeps = await this.addonVitestService.collectDependencies(packageManager);
        this.dependencyCollector.addDevDependencies(vitestDeps);
      }
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
