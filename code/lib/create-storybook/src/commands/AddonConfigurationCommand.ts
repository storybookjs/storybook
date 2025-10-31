import { AddonVitestService } from 'storybook/internal/cli';
import { type JsPackageManager } from 'storybook/internal/common';
import { CLI_COLORS, logger, prompt } from 'storybook/internal/node-logger';
import { ErrorCollector } from 'storybook/internal/telemetry';

import type { CommandOptions } from '../generators/types';

type ExecuteAddonConfigurationParams = {
  packageManager: JsPackageManager;
  addons: string[];
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
  constructor(private readonly addonVitestService = new AddonVitestService()) {}

  /** Execute addon configuration */
  async execute({
    packageManager,
    options,
    addons,
    configDir,
  }: ExecuteAddonConfigurationParams): Promise<ExecuteAddonConfigurationResult> {
    if (!configDir || addons.length === 0) {
      return { status: 'success' };
    }

    try {
      const { hasFailures, addonResults } = await this.configureAddons(
        packageManager,
        configDir,
        addons,
        options
      );

      if (addonResults.has('@storybook/addon-vitest')) {
        await this.addonVitestService.installPlaywright(packageManager, {
          yes: options.yes,
        });
      }

      return { status: hasFailures ? 'failed' : 'success' };
    } catch {
      return { status: 'failed' };
    }
  }

  /** Configure test addons (a11y and vitest) */
  private async configureAddons(
    packageManager: JsPackageManager,
    configDir: string,
    addons: string[],
    options: CommandOptions
  ) {
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

        await postinstallAddon(addon, {
          packageManager: packageManager.type,
          configDir,
          yes: options.yes,
          skipInstall: true,
          skipDependencyManagement: true,
          logger,
          prompt,
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
      task.success('Test addons configured successfully');
    }

    // Log results for each addon
    logger.log(
      CLI_COLORS.dimmed(
        addons
          .map((addon) => {
            const error = addonResults.get(addon);
            return error ? `❌ ${addon}` : `✅ ${addon}`;
          })
          .join('\n')
      )
    );

    return { hasFailures, addonResults };
  }
}

export const executeAddonConfiguration = (params: ExecuteAddonConfigurationParams) => {
  return new AddonConfigurationCommand().execute(params);
};
