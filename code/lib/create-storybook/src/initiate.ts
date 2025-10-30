import { ProjectType } from 'storybook/internal/cli';
import { type JsPackageManager } from 'storybook/internal/common';
import { withTelemetry } from 'storybook/internal/core-server';
import { CLI_COLORS, logTracker, logger } from 'storybook/internal/node-logger';

// eslint-disable-next-line depend/ban-dependencies
import execa from 'execa';

import {
  executeAddonConfiguration,
  executeDependencyInstallation,
  executeFinalization,
  executeFrameworkDetection,
  executeGeneratorExecution,
  executePreflightCheck,
  executeProjectDetection,
  executeUserPreferences,
} from './commands';
import { DependencyCollector } from './dependency-collector';
import { registerAllGenerators } from './generators';
import type { CommandOptions } from './generators/types';
import { FeatureCompatibilityService } from './services/FeatureCompatibilityService';
import { TelemetryService } from './services/TelemetryService';

/**
 * Main entry point for Storybook initialization (refactored)
 *
 * This is a clean, command-based orchestration that replaces the monolithic 986-line implementation
 * with a modular, testable approach.
 */
export async function doInitiate(options: CommandOptions): Promise<
  | {
      shouldRunDev: true;
      shouldOnboard: boolean;
      projectType: ProjectType;
      packageManager: JsPackageManager;
      storybookCommand?: string;
    }
  | { shouldRunDev: false }
> {
  // Initialize services
  const telemetryService = new TelemetryService(options.disableTelemetry);

  // Register all framework generators
  registerAllGenerators();

  let dependencyCollector: DependencyCollector | null = new DependencyCollector();

  // Step 1: Run preflight checks
  const { packageManager } = await executePreflightCheck(options);

  // Step 2: Detect project type
  const projectType = await executeProjectDetection(packageManager, options);

  // Step 3: Detect framework, renderer, and builder
  const { framework, builder, renderer } = await executeFrameworkDetection(
    projectType,
    packageManager,
    options
  );

  // Step 4: Get user preferences and feature selections (with framework/builder for validation)
  const { newUser, selectedFeatures } = await executeUserPreferences(packageManager, {
    yes: options.yes,
    options,
    framework,
    builder,
    dependencyCollector,
    projectType,
  });

  // Step 5: Execute generator with dependency collector (now with frameworkInfo)

  const { configDir, storybookCommand, shouldRunDev, extraAddons } =
    await executeGeneratorExecution({
      projectType,
      packageManager,
      frameworkInfo: { builder, framework, renderer },
      options,
      dependencyCollector,
      selectedFeatures,
    });

  // Step 6: Install all dependencies in a single operation
  await executeDependencyInstallation({
    packageManager,
    dependencyCollector,
    skipInstall: !!options.skipInstall,
    selectedFeatures,
  });

  // After dependencies are installed, we must not use the dependency collector anymore
  dependencyCollector = null;

  // Step 7: Configure addons (run postinstall scripts for configuration only)
  await executeAddonConfiguration({
    packageManager,
    addons: extraAddons,
    configDir,
    options,
  });

  // Step 8: Print final summary
  await executeFinalization({
    projectType,
    selectedFeatures,
    storybookCommand,
  });

  // Step 9: Track telemetry
  await telemetryService.trackInitWithContext(projectType, selectedFeatures, newUser);

  return {
    shouldRunDev: !!options.dev && !options.skipInstall && shouldRunDev !== false,
    shouldOnboard: newUser,
    projectType,
    packageManager,
    storybookCommand,
  };
}

const handleCommandFailure = async (): Promise<never> => {
  const logFile = await logTracker.writeToFile();
  logger.error('Storybook encountered an error during initialization');
  logger.log(`Storybook debug logs can be found at: ${logFile}`);
  logger.outro('Storybook exited with an error');
  process.exit(1);
};

/** Main initiate function with telemetry wrapper */
export async function initiate(options: CommandOptions): Promise<void> {
  const initiateResult = await withTelemetry(
    'init',
    {
      cliOptions: options,
      printError: (err) => !err.handled && logger.error(err),
    },
    async () => {
      logger.intro(CLI_COLORS.info(`Initializing Storybook`));

      const result = await doInitiate(options);

      logger.outro('Initiation completed');

      return result;
    }
  ).catch(handleCommandFailure);

  if (initiateResult?.shouldRunDev) {
    await runStorybookDev(initiateResult);
  }
}

/** Run Storybook dev server after installation */
async function runStorybookDev(result: {
  projectType: ProjectType;
  packageManager: JsPackageManager;
  storybookCommand?: string;
  shouldOnboard: boolean;
}): Promise<void> {
  const { projectType, packageManager, storybookCommand, shouldOnboard } = result;

  if (!storybookCommand) {
    return;
  }

  try {
    const supportsOnboarding = FeatureCompatibilityService.supportsOnboarding(projectType);

    const flags = [];

    // npm needs extra -- to pass flags to the command
    // in the case of Angular, we are calling `ng run` which doesn't need the extra `--`
    if (packageManager.type === 'npm' && projectType !== ProjectType.ANGULAR) {
      flags.push('--');
    }

    if (supportsOnboarding && shouldOnboard) {
      flags.push('--initial-path=/onboarding');
    }

    flags.push('--quiet');

    // instead of calling 'dev' automatically, we spawn a subprocess so that it gets
    // executed directly in the user's project directory. This avoid potential issues
    // with packages running in npxs' node_modules
    execa.command(`${storybookCommand} ${flags.join(' ')}`, {
      stdio: 'inherit',
    });
  } catch {
    // Do nothing here, as the command above will spawn a `storybook dev` process which does the error handling already
  }
}
