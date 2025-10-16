import type { ProjectType } from 'storybook/internal/cli';
import { type JsPackageManager } from 'storybook/internal/common';
import { CLI_COLORS, logger, prompt } from 'storybook/internal/node-logger';

import { getAddonA11yDependencies } from '../addon-dependencies/addon-a11y';
import { getAddonVitestDependencies } from '../addon-dependencies/addon-vitest';
import type { DependencyCollector } from '../dependency-collector';
import type { CommandOptions, Generator, GeneratorFeature } from '../generators/types';
import { ErrorCollectionService } from '../services/ErrorCollectionService';

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
  private readonly addonsToConfig = ['@storybook/addon-a11y', '@storybook/addon-vitest'];

  constructor(private dependencyCollector: DependencyCollector) {}

  /** Execute addon configuration */
  async execute({
    projectType,
    packageManager,
    options,
    selectedFeatures,
    generatorResult,
  }: ExecuteAddonConfigurationParams): Promise<ExecuteAddonConfigurationResult> {
    if (!selectedFeatures.has('test')) {
      return { status: 'success' };
    }

    try {
      await this.collectAddonDependencies(projectType, packageManager);

      const { hasFailures } = await this.configureTestAddons(
        packageManager,
        generatorResult,
        options
      );
      return { status: hasFailures ? 'failed' : 'success' };
    } catch {
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
    generatorResult: Awaited<ReturnType<Generator>>,
    options: CommandOptions
  ): Promise<{ hasFailures: boolean }> {
    // Import postinstallAddon from cli-storybook package
    const { postinstallAddon } = await import('../../../cli-storybook/src/postinstallAddon');

    // Get versioned addon packages
    const addons = await packageManager.getVersionedPackages(this.addonsToConfig);

    this.dependencyCollector.addDevDependencies(addons);

    // Note: Dependencies are added by the dependency collector, not here

    const task = prompt.taskLog({
      id: 'configure-addons',
      title: 'Configuring test addons...',
    });

    // Track failures for each addon
    const addonResults = new Map<string, null | any>();

    // Configure each addon
    for (const addon of this.addonsToConfig) {
      // const taskGroup = task.group(`Configuring ${addon}...`);

      try {
        task.message(`Configuring ${addon}...`);

        const { configDir } = generatorResult;

        task.message(`Running postinstall for ${addon}...`);

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
        ErrorCollectionService.addError(e);
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
    logger.log('Addon configuration results:');
    logger.log(
      CLI_COLORS.dimmed(
        this.addonsToConfig
          .map((addon) => {
            const success = addonResults.get(addon);
            return success ? `✅ ${addon}` : `❌ ${addon}`;
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
