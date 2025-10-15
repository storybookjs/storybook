import type { ProjectType } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';
import { CLI_COLORS, logger, prompt } from 'storybook/internal/node-logger';

import { getAddonA11yDependencies } from '../addon-dependencies/addon-a11y';
import { getAddonVitestDependencies } from '../addon-dependencies/addon-vitest';
import type { DependencyCollector } from '../dependency-collector';
import type { CommandOptions, Generator, GeneratorFeature } from '../generators/types';

type ExecuteAddonConfigurationParams = {
  packageManager: JsPackageManager;
  projectType: ProjectType;
  selectedFeatures: Set<GeneratorFeature>;
  generatorResult: Awaited<ReturnType<Generator>>;
  options: CommandOptions;
};

export type ExecuteAddonConfigurationResult = {
  status: 'failed' | 'success';
};

/**
 * Command for configuring Storybook addons
 *
 * Responsibilities:
 *
 * - Run postinstall scripts for test addons (a11y, vitest)
 * - Configure addons without triggering installations
 * - Handle configuration errors gracefully
 */
export class AddonConfigurationCommand {
  constructor(private dependencyCollector: DependencyCollector) {}

  /** Execute addon configuration */
  async execute({
    projectType,
    packageManager,
    options,
    selectedFeatures,
  }: ExecuteAddonConfigurationParams): Promise<ExecuteAddonConfigurationResult> {
    if (!selectedFeatures.has('test')) {
      return { status: 'success' };
    }

    try {
      await this.collectAddonDependencies(projectType, packageManager);
      await this.configureTestAddons(packageManager, options);
      return { status: 'success' };
    } catch (e) {
      return { status: 'failed' };
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

  /** Configure test addons (a11y and vitest) */
  private async configureTestAddons(
    packageManager: JsPackageManager,
    options: CommandOptions
  ): Promise<void> {
    // Import postinstallAddon from cli-storybook package
    const { postinstallAddon } = await import('../../../cli-storybook/src/postinstallAddon');
    const configDir = '.storybook';

    // Get versioned addon packages
    const addons = await packageManager.getVersionedPackages([
      '@storybook/addon-a11y',
      '@storybook/addon-vitest',
    ]);

    this.dependencyCollector.addDevDependencies(addons);

    // Note: Dependencies are added by the dependency collector, not here

    const task = prompt.taskLog({
      id: 'configure-addons',
      title: 'Configuring test addons...',
    });

    let failed = false;
    let addonA11yFailed = false;
    const addonVitestFailed = false;

    try {
      // Run a11y addon postinstall (runs automigration)
      task.message('Configuring @storybook/addon-a11y...');

      await postinstallAddon('@storybook/addon-a11y', {
        packageManager: packageManager.type,
        configDir,
        yes: options.yes,
        skipInstall: true,
        skipDependencyManagement: true,
      });

      task.message('A11y addon configured\n');
    } catch (err) {
      task.message(CLI_COLORS.error(`Failed to configure test addons`));
      failed = true;
      addonA11yFailed = true;
    }

    // Run vitest addon postinstall (configuration only)
    try {
      task.message('Configuring @storybook/addon-vitest...');
      await postinstallAddon('@storybook/addon-vitest', {
        packageManager: packageManager.type,
        configDir,
        yes: options.yes,
        skipInstall: true,
        skipDependencyManagement: true,
      });
      task.message('Vitest addon configured\n');
    } catch (err) {
      task.message(CLI_COLORS.error(`Failed to configure test addons`));
      failed = true;
    }

    if (failed) {
      task.error('Failed to configure test addons');
    } else {
      // TODO: CHANGE BACK TO SUCCESS
      task.success('Configuring test addons...');
    }

    logger.log(
      CLI_COLORS.dimmed(
        [
          addonA11yFailed
            ? CLI_COLORS.error('x Failed to install a11y addon')
            : '- @storybook/a11y-addon',
          addonVitestFailed
            ? CLI_COLORS.error('x Failed to install vitest addon')
            : '- @storybook/addon-vitest',
        ].join('\n')
      )
    );
  }
}

export const executeAddonConfiguration = ({
  dependencyCollector,
  ...params
}: ExecuteAddonConfigurationParams & { dependencyCollector: DependencyCollector }) => {
  return new AddonConfigurationCommand(dependencyCollector).execute(params);
};
