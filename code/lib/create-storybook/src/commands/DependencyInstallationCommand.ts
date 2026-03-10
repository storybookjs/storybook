import { AddonVitestService } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';
import { ErrorCollector } from 'storybook/internal/telemetry';
import { Feature } from 'storybook/internal/types';

import type { DependencyCollector } from '../dependency-collector';

type DependencyInstallationCommandParams = {
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
    private readonly dependencyCollector: DependencyCollector,
    private readonly packageManager: JsPackageManager,
    private readonly addonVitestService = new AddonVitestService(packageManager)
  ) {}
  /** Execute dependency installation */
  async execute({
    skipInstall = false,
    selectedFeatures,
  }: DependencyInstallationCommandParams): Promise<{ status: 'success' | 'failed' }> {
    await this.collectAddonDependencies(selectedFeatures);

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

      await this.packageManager.addDependencies(
        { type: 'dependencies', skipInstall: true },
        dependencies
      );
    }

    if (devDependencies.length > 0) {
      task.message(
        'Adding devDependencies:\n' + devDependencies.map((dep) => `- ${dep}`).join('\n')
      );

      await this.packageManager.addDependencies(
        { type: 'devDependencies', skipInstall: true },
        devDependencies
      );
    }

    task.success('Dependencies added to package.json', { showLog: true });

    if (!skipInstall && this.dependencyCollector.hasPackages()) {
      try {
        await this.packageManager.installDependencies();
      } catch (err) {
        ErrorCollector.addError(err);
        return { status: 'failed' };
      }
    }

    return { status: 'success' };
  }

  /** Collect addon dependencies without installing them */
  private async collectAddonDependencies(selectedFeatures: Set<Feature>): Promise<void> {
    try {
      if (selectedFeatures.has(Feature.TEST)) {
        const vitestDeps = await this.addonVitestService.collectDependencies();
        this.dependencyCollector.addDevDependencies(vitestDeps);
      }
    } catch (err) {
      logger.warn(`Failed to collect addon dependencies: ${err}`);
    }
  }
}

export const executeDependencyInstallation = ({
  dependencyCollector,
  packageManager,
  ...props
}: DependencyInstallationCommandParams & {
  dependencyCollector: DependencyCollector;
  packageManager: JsPackageManager;
}) => new DependencyInstallationCommand(dependencyCollector, packageManager).execute(props);
