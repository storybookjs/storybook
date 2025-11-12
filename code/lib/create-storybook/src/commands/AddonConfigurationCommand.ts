import { AddonVitestService } from 'storybook/internal/cli';
import { type JsPackageManager } from 'storybook/internal/common';
import { CLI_COLORS, logger, prompt } from 'storybook/internal/node-logger';
import { ErrorCollector } from 'storybook/internal/telemetry';

import { dedent } from 'ts-dedent';

import type { CommandOptions } from '../generators/types';

const ADDON_INSTALLATION_INSTRUCTIONS = {
  '@storybook/addon-vitest':
    'https://storybook.js.org/docs/writing-tests/integrations/vitest-addon#manual-setup',
} as { [key: string]: string };

type ExecuteAddonConfigurationParams = {
  packageManager: JsPackageManager;
  addons: string[];
  options: CommandOptions;
  configDir?: string;
  dependencyInstallationResult: { status: 'success' | 'failed' };
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
    dependencyInstallationResult,
  }: ExecuteAddonConfigurationParams): Promise<ExecuteAddonConfigurationResult> {
    if (
      dependencyInstallationResult.status === 'failed' &&
      this.getAddonsWithInstructions(addons).length > 0
    ) {
      this.logManualAddonInstructions(addons);
      return { status: 'failed' };
    }

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
    } catch (e) {
      logger.error('Unexpected error during addon configuration:');
      logger.error(e);
      return { status: 'failed' };
    }
  }

  private getAddonsWithInstructions(addons: string[]): string[] {
    return addons.filter((addon) => ADDON_INSTALLATION_INSTRUCTIONS[addon]);
  }

  private logManualAddonInstructions(addons: string[]): void {
    const addonsWithInstructions = this.getAddonsWithInstructions(addons);

    if (addonsWithInstructions.length > 0) {
      logger.warn(dedent`
      The following addons couldn't be configured:

      ${addonsWithInstructions
        .map((addon) => {
          const manualInstructionLink = ADDON_INSTALLATION_INSTRUCTIONS[addon];

          return `- ${addon}: ${manualInstructionLink}`;
        })
        .join('\n')}

      ${
        addonsWithInstructions.length > 0
          ? `Please follow each addon's configuration instructions manually.`
          : ''
      }
      `);
    }
  }

  private getAddonInstructions(addons: string[]): string {
    return addons
      .map((addon) => {
        const instructions =
          ADDON_INSTALLATION_INSTRUCTIONS[addon as keyof typeof ADDON_INSTALLATION_INSTRUCTIONS];
        return instructions ? dedent`- ${addon}: ${instructions}` : null;
      })
      .filter(Boolean)
      .join('\n');
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

export const executeAddonConfiguration = (params: ExecuteAddonConfigurationParams) => {
  return new AddonConfigurationCommand().execute(params);
};
