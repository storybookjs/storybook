import { type JsPackageManager } from 'storybook/internal/common';
import { CLI_COLORS, logger, prompt } from 'storybook/internal/node-logger';
import { ErrorCollector } from 'storybook/internal/telemetry';

import type { DependencyCollector } from '../dependency-collector';
import type { CommandOptions, GeneratorFeature } from '../generators/types';

type ExecuteAddonConfigurationParams = {
  packageManager: JsPackageManager;
  selectedFeatures: Set<GeneratorFeature>;
  options: CommandOptions;
  configDir?: string;
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
    packageManager,
    options,
    selectedFeatures,
    configDir,
  }: ExecuteAddonConfigurationParams): Promise<ExecuteAddonConfigurationResult> {
    if (!configDir) {
      return { status: 'success' };
    }

    try {
      const { hasFailures } = await this.configureAddons(
        packageManager,
        configDir,
        selectedFeatures,
        options
      );
      return { status: hasFailures ? 'failed' : 'success' };
    } catch {
      return { status: 'failed' };
    }
  }

  /** Configure test addons (a11y and vitest) */
  private async configureAddons(
    packageManager: JsPackageManager,
    configDir: string,
    selectedFeatures: Set<GeneratorFeature>,
    options: CommandOptions
  ): Promise<{ hasFailures: boolean }> {
    // Import postinstallAddon from cli-storybook package
    const { postinstallAddon } = await import('../../../cli-storybook/src/postinstallAddon');

    const addonsToConfig = selectedFeatures.has('test')
      ? ['@storybook/addon-a11y', '@storybook/addon-vitest']
      : ['@storybook/addon-a11y'];

    // Get versioned addon packages
    const addons = await packageManager.getVersionedPackages(addonsToConfig);

    this.dependencyCollector.addDevDependencies(addons);

    // Note: Dependencies are added by the dependency collector, not here

    const task = prompt.taskLog({
      id: 'configure-addons',
      title: 'Configuring addons...',
    });

    // Track failures for each addon
    const addonResults = new Map<string, null | any>();

    // Configure each addon
    for (const addon of addonsToConfig) {
      // const taskGroup = task.group(`Configuring ${addon}...`);

      try {
        task.message(`Configuring ${addon}...`);

        await postinstallAddon(addon, {
          packageManager: packageManager.type,
          configDir,
          yes: options.yes,
          skipInstall: true,
          skipDependencyManagement: true,
        });

        task.message(`${addon} configured\n`);
        addonResults.set(addon, null);
      } catch (e) {
        ErrorCollector.addError(e);
        addonResults.set(addon, e);
      }
    }

    const hasFailures = [...addonResults.values()].some((result) => result !== null);

    // Set final task status
    if (hasFailures) {
      task.error('Failed to configure test addons');
    } else {
      // TODO: CHANGE BACK TO SUCCESS
      task.success('Test addons configured successfully');
    }

    // Log results for each addon
    logger.log(
      CLI_COLORS.dimmed(
        addonsToConfig
          .map((addon) => {
            const error = addonResults.get(addon);
            return error ? `❌ ${addon}` : `✅ ${addon}`;
          })
          .join('\n')
      )
    );

    return { hasFailures };
  }
}

export const executeAddonConfiguration = ({
  dependencyCollector,
  ...params
}: ExecuteAddonConfigurationParams & { dependencyCollector: DependencyCollector }) => {
  return new AddonConfigurationCommand(dependencyCollector).execute(params);
};
