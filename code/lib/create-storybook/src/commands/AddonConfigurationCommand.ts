import type { JsPackageManager } from 'storybook/internal/common';
import { CLI_COLORS, logger, prompt } from 'storybook/internal/node-logger';

import type { DependencyCollector } from '../dependency-collector';
import type { CommandOptions, GeneratorFeature } from '../generators/types';

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
  async execute(
    packageManager: JsPackageManager,
    selectedFeatures: Set<GeneratorFeature>,
    options: CommandOptions
  ): Promise<void> {
    if (!selectedFeatures.has('test')) {
      return;
    }

    await this.configureTestAddons(packageManager, options);
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
      task.message('Configuring a11y addon...');

      await postinstallAddon('@storybook/addon-a11y', {
        packageManager: packageManager.type,
        configDir,
        yes: options.yes,
        skipInstall: true,
        skipDependencyManagement: true,
      });

      task.message('A11y addon configured');
    } catch (err) {
      task.message(CLI_COLORS.error(`Failed to configure test addons`));
      failed = true;
      addonA11yFailed = true;
      // Don't throw - addon configuration failures shouldn't fail the entire init
    }

    // Run vitest addon postinstall (configuration only)
    // try {
    //   await postinstallAddon('@storybook/addon-vitest', {
    //     packageManager: packageManager.type,
    //     configDir,
    //     yes: options.yes,
    //     skipInstall: true,
    //     skipDependencyManagement: true,
    //   });
    // } catch (err) {
    //   task.message(CLI_COLORS.error(`Failed to configure test addons`));
    //   failed = true;
    //   addonVitestFailed = true;
    //   // Don't throw - addon configuration failures shouldn't fail the entire init
    // }

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

export const executeAddonConfiguration = (
  packageManager: JsPackageManager,
  dependencyCollector: DependencyCollector,
  selectedFeatures: Set<GeneratorFeature>,
  options: CommandOptions
) => {
  return new AddonConfigurationCommand(dependencyCollector).execute(
    packageManager,
    selectedFeatures,
    options
  );
};
