import { ProjectType } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';
import { withTelemetry } from 'storybook/internal/core-server';
import { CLI_COLORS, logger, prompt } from 'storybook/internal/node-logger';

import { dedent } from 'ts-dedent';

import {
  executeAddonConfiguration,
  executeDependencyInstallation,
  executeFinalization,
  executeGeneratorExecution,
  executePreflightCheck,
  executeProjectDetection,
  executeUserPreferences,
} from './commands';
import { DependencyCollector } from './dependency-collector';
import { registerAllGenerators } from './generators';
import type { CommandOptions } from './generators/types';
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
      storybookCommand: string;
    }
  | { shouldRunDev: false }
> {
  // Initialize services
  const telemetryService = new TelemetryService(options.disableTelemetry);

  // Register all framework generators
  registerAllGenerators();

  // Step 1: Run preflight checks
  const { packageManager } = await executePreflightCheck(options);

  // Step 2: Get user preferences and feature selections
  const { newUser, selectedFeatures } = await executeUserPreferences(packageManager, {
    yes: options.yes,
    disableTelemetry: options.disableTelemetry,
  });

  // Step 3: Detect project type
  const projectType = await executeProjectDetection(packageManager, options);

  // Step 4: Track telemetry with complete context
  await telemetryService.trackInitWithContext(projectType, selectedFeatures, newUser);

  // Handle React Native special case (exit early)
  if ([ProjectType.REACT_NATIVE, ProjectType.REACT_NATIVE_AND_RNW].includes(projectType)) {
    return handleReactNativeInstallation(projectType, packageManager);
  }

  // Step 5: Execute generator with dependency collector
  const dependencyCollector = new DependencyCollector();
  const { storybookCommand } = await executeGeneratorExecution(
    projectType,
    packageManager,
    options,
    selectedFeatures,
    dependencyCollector
  );

  // Step 6: Configure addons (run postinstall scripts for configuration only)
  await executeAddonConfiguration(packageManager, dependencyCollector, selectedFeatures, options);

  // Step 7: Install all dependencies in a single operation
  await executeDependencyInstallation(packageManager, dependencyCollector, options.skipInstall);

  // Step 8: Print final summary
  await executeFinalization(projectType, selectedFeatures, storybookCommand);

  return {
    shouldRunDev: !!options.dev && !options.skipInstall,
    shouldOnboard: newUser,
    projectType,
    packageManager,
    storybookCommand,
  };
}

/** Handle React Native installation special case */
function handleReactNativeInstallation(
  projectType: ProjectType,
  packageManager: JsPackageManager
): { shouldRunDev: false } {
  logger.log(dedent`
    ${CLI_COLORS.warning('React Native (RN) Storybook installation is not 100% automated.')}

    To run RN Storybook, you will need to:

    1. Replace the contents of your app entry with the following

    ${CLI_COLORS.info(' ' + "export {default} from './.rnstorybook';" + ' ')}

    2. Wrap your metro config with the withStorybook enhancer function like this:

    ${CLI_COLORS.info(' ' + "const withStorybook = require('@storybook/react-native/metro/withStorybook');" + ' ')}
    ${CLI_COLORS.info(' ' + 'module.exports = withStorybook(defaultConfig);' + ' ')}

    For more details go to:
    https://github.com/storybookjs/react-native#getting-started

    Then to start RN Storybook, run:

    ${CLI_COLORS.cta(' ' + packageManager.getRunCommand('start') + ' ')}
  `);

  if (projectType === ProjectType.REACT_NATIVE_AND_RNW) {
    logger.log(dedent`

      ${CLI_COLORS.success('React Native Web (RNW) Storybook is fully installed.')}

      To start RNW Storybook, run:

      ${CLI_COLORS.cta(' ' + packageManager.getRunCommand('storybook') + ' ')}
    `);
  }

  return { shouldRunDev: false };
}

/** Main initiate function with telemetry wrapper */
export async function initiate(options: CommandOptions): Promise<void> {
  const initiateResult = await withTelemetry(
    'init',
    {
      cliOptions: options,
      printError: (err) => !err.handled && logger.error(err),
    },
    async () => {
      try {
        const result = await doInitiate(options);
        return result;
      } catch (err) {
        logger.outro(CLI_COLORS.error(`Storybook failed to initialize your project.`));

        process.exit(1);
      }
    }
  );

  if (initiateResult?.shouldRunDev) {
    await runStorybookDev(initiateResult);
  }
}

/** Run Storybook dev server after installation */
async function runStorybookDev(result: {
  projectType: ProjectType;
  packageManager: JsPackageManager;
  storybookCommand: string;
  shouldOnboard: boolean;
}): Promise<void> {
  const { projectType, packageManager, storybookCommand, shouldOnboard } = result;

  prompt.setPromptLibrary('prompts');
  logger.log('\nRunning Storybook');

  try {
    const supportsOnboarding = [
      ProjectType.REACT_SCRIPTS,
      ProjectType.REACT,
      ProjectType.WEBPACK_REACT,
      ProjectType.REACT_PROJECT,
      ProjectType.NEXTJS,
      ProjectType.VUE3,
      ProjectType.ANGULAR,
    ].includes(projectType);

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
    packageManager.runPackageCommandSync(
      storybookCommand.replace(/^yarn /, ''),
      flags,
      undefined,
      'inherit'
    );
  } catch {
    // Do nothing here, as the command above will spawn a `storybook dev` process which does the error handling already
  }
}
