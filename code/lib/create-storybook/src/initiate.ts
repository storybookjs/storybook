import { resolve } from 'node:path';

import { ProjectType } from 'storybook/internal/cli';
import {
  HandledError,
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

  const { configDir, storybookCommand, shouldRunDev, extraAddons, postInstall } =
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

  // Generators may need to perform tasks once dependencies are installed (e.g. running a CLI that
  // ships with one of those dependencies). We only run this when the install actually succeeded
  // and we didn't skip it, otherwise the dependency-provided binary likely isn't available.
  if (postInstall && !options.skipInstall && dependencyInstallationResult.status === 'success') {
    try {
      await postInstall();
    } catch (err) {
      logger.warn(`Post-install step failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Step 7: Configure addons (run postinstall scripts for configuration only)
  await executeAddonConfiguration({
    packageManager,
    addons: extraAddons,
    configDir,
    options,
  });

  // Step 8: Print final summary
  const hasAiFeature = selectedFeatures.has(Feature.AI);
  if (configDir && isAiSetupAvailable) {
    // Persist init-time AI opt-in/opt-out so the dev server can gate AI-related UI
    // (checklist item, copy-prompt button) on the user's actual choice — not on
    // a telemetry-event side effect. Scoped to the project's configDir so a
    // monorepo with hoisted `node_modules/.cache` doesn't leak the flag across
    // sibling Storybook projects. This is a tiny local file with no PII, so it
    // is written even when telemetry is disabled.
    await cache
      .set('ai-init-opt-in', {
        timestamp: Date.now(),
        configDir: resolve(configDir),
        answer: hasAiFeature,
      })
      .catch(() => {});
    // Telemetry event remains for analytics. UI logic does not depend on it.
    await telemetry('ai-init-opt-in', {
      answer: hasAiFeature,
    }).catch(() => {});
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
      // enable telemetry if nothing else specified in env var or CLI options
      fallbackTelemetryState: true,
    },
    async () => {
      const result = await doInitiate(options);
      logger.outro('');
      return result;
    }
  ).catch(() => {
    return handleCommandFailure(options.logfile);
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
