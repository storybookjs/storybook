import type { JsPackageManager } from 'storybook/internal/common';
import { prompt } from 'storybook/internal/node-logger';

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
  /** Execute addon configuration */
  async execute(
    packageManager: JsPackageManager,
    selectedFeatures: Set<GeneratorFeature>,
    options: CommandOptions
  ): Promise<void> {
    if (!selectedFeatures.has('test')) {
      return;
    }

    const task = prompt.taskLog({
      id: 'configure-addons',
      title: 'Configuring test addons...',
    });

    try {
      await this.configureTestAddons(packageManager, options);
      task.success('Test addons configured');
    } catch (err) {
      task.error(`Failed to configure test addons: ${String(err)}`);
      // Don't throw - addon configuration failures shouldn't fail the entire init
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

    // Note: Dependencies are added by the dependency collector, not here

    // Run a11y addon postinstall (runs automigration)
    await postinstallAddon('@storybook/addon-a11y', {
      packageManager: packageManager.type,
      configDir,
      yes: options.yes,
      skipInstall: true,
      skipDependencyManagement: true,
    });

    // Run vitest addon postinstall (configuration only)
    await postinstallAddon('@storybook/addon-vitest', {
      packageManager: packageManager.type,
      configDir,
      yes: options.yes,
      skipInstall: true,
      skipDependencyManagement: true,
    });
  }
}

export const executeAddonConfiguration = (
  packageManager: JsPackageManager,
  selectedFeatures: Set<GeneratorFeature>,
  options: CommandOptions
) => {
  return new AddonConfigurationCommand().execute(packageManager, selectedFeatures, options);
};
