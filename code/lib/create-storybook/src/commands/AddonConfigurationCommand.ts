import { AddonVitestService } from 'storybook/internal/cli';
import { type JsPackageManager } from 'storybook/internal/common';
import { CLI_COLORS, logger, prompt } from 'storybook/internal/node-logger';
import { ErrorCollector } from 'storybook/internal/telemetry';

import addonVitestPostinstall from '../../../../addons/vitest/src/postinstall';
import type { CommandOptions } from '../generators/types';
import { TelemetryService } from '../services';

type ExecuteAddonConfigurationParams = {
  addons: string[];
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
  constructor(
    readonly packageManager: JsPackageManager,
    private readonly commandOptions: CommandOptions,
    private readonly addonVitestService = new AddonVitestService(packageManager),
    private readonly telemetryService = new TelemetryService(commandOptions.disableTelemetry)
  ) {}

  /** Execute addon configuration */
  async execute({
    addons,
    configDir,
  }: ExecuteAddonConfigurationParams): Promise<ExecuteAddonConfigurationResult> {
    if (!configDir || addons.length === 0) {
      return { status: 'success' };
    }

    try {
      const { hasFailures, addonResults } = await this.configureAddons(configDir, addons);

      if (addonResults.has('@storybook/addon-vitest')) {
        const { result } = await this.addonVitestService.installPlaywright({
          yes: this.commandOptions.yes,
        });
        // Map outcome to telemetry decision
        await this.telemetryService.trackPlaywrightPromptDecision(result);
      }

      return { status: hasFailures ? 'failed' : 'success' };
    } catch (e) {
      logger.error('Unexpected error during addon configuration:');
      logger.error(e);
      return { status: 'failed' };
    }
  }

  /** Configure test addons (a11y and vitest) */
  private async configureAddons(configDir: string, addons: string[]) {
    // Import postinstallAddon from cli-storybook package
    const { postinstallAddon } = await import('../../../cli-storybook/src/postinstallAddon');

    const task = prompt.taskLog({
      id: 'configure-addons',
      title: 'Configuring addons...',
    });

    // Track failures for each addon
    const addonResults = new Map<string, null | any>();

    // Configure each addon
    for (const addon of addons) {
      try {
        task.message(`Configuring ${addon}...`);

        const options = {
          packageManager: this.packageManager.type,
          configDir,
          yes: this.commandOptions.yes,
          skipInstall: true,
          skipDependencyManagement: true,
          logger,
          prompt,
        };

        if (addon === '@storybook/addon-vitest') {
          await addonVitestPostinstall(options);
        } else {
          await postinstallAddon(addon, options);
        }

        task.message(`${addon} configured\n`);
        addonResults.set(addon, null);
      } catch (e) {
        logger.debug(e);
        ErrorCollector.addError(e);
        addonResults.set(addon, e);
      }
    }

    const hasFailures = [...addonResults.values()].some((result) => result !== null);

    // Set final task status
    if (hasFailures) {
      task.error('Failed to configure addons');
    } else {
      task.success('Addons configured successfully');
    }

    // Log results for each addon, each as a separate log entry
    addons.forEach((addon, index) => {
      const error = addonResults.get(addon);
      logger.log(CLI_COLORS.muted(error ? `❌ ${addon}` : `✅ ${addon}`), {
        spacing: index === 0 ? 1 : 0,
      });
    });

    return { hasFailures, addonResults };
  }
}

export const executeAddonConfiguration = ({
  packageManager,
  options,
  ...rest
}: ExecuteAddonConfigurationParams & {
  packageManager: JsPackageManager;
  options: CommandOptions;
}) => {
  return new AddonConfigurationCommand(packageManager, options).execute(rest);
};
