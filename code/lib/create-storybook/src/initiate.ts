import { ProjectType } from 'storybook/internal/cli';
import {
  type JsPackageManager,
  PackageManagerName,
  cache,
  executeCommand,
} from 'storybook/internal/common';
import { getServerPort, withTelemetry } from 'storybook/internal/core-server';
import { logTracker, logger } from 'storybook/internal/node-logger';
import { telemetry, setTelemetryEnabled } from 'storybook/internal/telemetry';
import { Feature } from 'storybook/internal/types';
import type {
  SupportedBuilder,
  SupportedFramework,
  SupportedRenderer,
} from 'storybook/internal/types';

import {
  executeAddonConfiguration,
  executeDependencyInstallation,
  executeFinalization,
  executeFrameworkDetection,
  executeGeneratorExecution,
  executePreflightCheck,
  executeProjectDetection,
  executeUserPreferences,
} from './commands/index.ts';
import { DependencyCollector } from './dependency-collector.ts';
import { registerAllGenerators } from './generators/index.ts';
import type { CommandOptions } from './generators/types.ts';
import { FeatureCompatibilityService } from './services/FeatureCompatibilityService.ts';
import { TelemetryService } from './services/TelemetryService.ts';

/** Validate test feature compatibility and check AI setup support */
async function checkFeatureSupport(
  packageManager: JsPackageManager,
  framework: SupportedFramework | null,
  builder: SupportedBuilder,
  renderer: SupportedRenderer
): Promise<{
  isTestFeatureAvailable: boolean;
  isAiSetupAvailable: boolean;
}> {
  const featureService = new FeatureCompatibilityService(packageManager);

  const result = await featureService.validateTestFeatureCompatibility(
    framework,
    builder,
    process.cwd()
  );

  const aiSetup = FeatureCompatibilityService.supportsAISetupFeature(renderer, builder, framework);

  return {
    isTestFeatureAvailable: result.compatible,
    isAiSetupAvailable: aiSetup,
  };
}

/**
 * Main entry point for Storybook initialization
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
      storybookCommand?: string | null;
    }
  | { shouldRunDev: false }
> {
  if (options.agent) {
    options.yes = true;
  }

  // Initialize services
  const telemetryService = new TelemetryService();

  // Register all framework generators
  registerAllGenerators();

  let dependencyCollector: DependencyCollector | null = new DependencyCollector();

  // Step 1: Run preflight checks
  const { packageManager, isEmptyProject } = await executePreflightCheck(options);

  // Step 2: Detect project type
  const { projectType, language } = await executeProjectDetection(packageManager, options);

  // Step 3: Detect framework, renderer, and builder
  const { framework, builder, renderer } = await executeFrameworkDetection(
    projectType,
    packageManager,
    options
  );

  // Step 4: Get user preferences and feature selections (with framework/builder for validation)
  const { isTestFeatureAvailable, isAiSetupAvailable } = await checkFeatureSupport(
    packageManager,
    framework,
    builder,
    renderer
  );

  const { newUser, selectedFeatures } = await executeUserPreferences({
    options,
    framework,
    builder,
    renderer,
    projectType,
    isTestFeatureAvailable,
    // Skip AI feature recommendation when scaffolding into an empty directory,
    // since the user hasn't yet committed to a project setup where AI tooling adds value.
    isAiSetupAvailable: isAiSetupAvailable && !isEmptyProject,
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
      language,
    });

  // Step 6: Install all dependencies in a single operation
  const dependencyInstallationResult = await executeDependencyInstallation({
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
  const hasAiFeature = selectedFeatures.has(Feature.AI);
  if (hasAiFeature) {
    // Record the init-time AI opt-in in the telemetry event cache so the server can gate
    // AI-related UI (checklist item, analytics) via the universal checklist store.
    await telemetry('ai-init-opt-in', {}).catch(() => {});
  }
  await executeFinalization({
    showAgentFollowUp: !!options.agent && hasAiFeature,
    showAiInstructions: hasAiFeature,
    logfile: options.logfile,
    storybookCommand,
  });

  // Step 9: Track telemetry
  await telemetryService.trackInitWithContext(projectType, selectedFeatures, newUser);

  // Signal dev to redirect to onboarding on first run
  if (selectedFeatures.has(Feature.ONBOARDING)) {
    await cache.set('onboarding-pending', true).catch(() => {});
  }

  return {
    shouldRunDev:
      !!options.dev &&
      !options.skipInstall &&
      shouldRunDev !== false &&
      dependencyInstallationResult.status === 'success',
    shouldOnboard: newUser,
    projectType,
    packageManager,
    storybookCommand,
  };
}

const handleCommandFailure = async (logFilePath: string | boolean | undefined): Promise<never> => {
  const logFile = await logTracker.writeToFile(logFilePath);
  logger.error('Storybook encountered an error during initialization');
  logger.log(`Debug logs are written to: ${logFile}`);
  logger.outro('Storybook exited with an error');
  process.exit(1);
};

// cli command -> ctrl c -> exit 0
// process.on('SIGINT', () => {
// })

/** Main initiate function with telemetry wrapper */
export async function initiate(options: CommandOptions): Promise<void> {
  const initiateResult = await withTelemetry(
    'init',
    {
      cliOptions: options,
      printError: (err) => !err.handled && logger.error(err),
    },
    async () => {
      // we need to explicitly set this before init to not delay the events until the end of the flow
      await setTelemetryEnabled(!options.disableTelemetry);

      const result = await doInitiate(options);

      logger.outro('');

      return result;
    }
  ).catch(() => {
    handleCommandFailure(options.logfile);
  });

  // Launch dev server only if --dev was explicitly passed
  if (!options.agent && initiateResult?.shouldRunDev) {
    await runStorybookDev(initiateResult);
  }
}

/** Run Storybook dev server after installation */
async function runStorybookDev(result: {
  projectType: ProjectType;
  packageManager: JsPackageManager;
  storybookCommand?: string | null;
}): Promise<void> {
  const { projectType, packageManager, storybookCommand } = result;

  if (!storybookCommand) {
    return;
  }

  try {
    const parts = storybookCommand.split(' ');

    // Angular CLI throws "Unknown argument: silent"
    if (packageManager.type === 'npm' && projectType !== ProjectType.ANGULAR) {
      parts.push('--silent');
    }

    // in the case of Angular, we are calling `ng run` which doesn't allow passing flags to the command
    const supportSbFlags = projectType !== ProjectType.ANGULAR;

    if (supportSbFlags) {
      // npm needs extra -- to pass flags to the command
      const doesNeedExtraDash =
        packageManager.type === PackageManagerName.NPM ||
        packageManager.type === PackageManagerName.BUN;

      if (doesNeedExtraDash) {
        parts.push('--');
      }

      const defaultPort = 6006;
      const availablePort = await getServerPort(defaultPort);
      const useAlternativePort = availablePort !== defaultPort;

      if (useAlternativePort) {
        parts.push(`-p`, `${availablePort}`);
      }

      parts.push('--quiet');
    }

    // instead of calling 'dev' automatically, we spawn a subprocess so that it gets
    // executed directly in the user's project directory. This avoid potential issues
    // with packages running in npxs' node_modules
    const [command, ...args] = [...parts];

    await executeCommand({
      command: command,
      args,
      stdio: 'inherit',
    });
  } catch {
    // Do nothing here, as the command above will spawn a `storybook dev` process which does the error handling already
  }
}
