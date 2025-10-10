import fs from 'node:fs/promises';

import * as babel from 'storybook/internal/babel';
import {
  type Builder,
  type NpmOptions,
  ProjectType,
  type Settings,
  detect,
  detectLanguage,
  detectPnp,
  globalSettings,
  installableProjectTypes,
  isStorybookInstantiated,
} from 'storybook/internal/cli';
import {
  HandledError,
  type JsPackageManager,
  JsPackageManagerFactory,
  getProjectRoot,
  invalidateProjectRootCache,
  isCI,
  versions,
} from 'storybook/internal/common';
import { withTelemetry } from 'storybook/internal/core-server';
import { CLI_COLORS, logger, prompt } from 'storybook/internal/node-logger';
import { NxProjectDetectedError } from 'storybook/internal/server-errors';
import { telemetry } from 'storybook/internal/telemetry';

import * as find from 'empathic/find';
import picocolors from 'picocolors';
import { getProcessAncestry } from 'process-ancestry';
import { lt, prerelease } from 'semver';
import { dedent } from 'ts-dedent';

import { getAddonA11yDependencies } from './addon-dependencies/addon-a11y';
import { getAddonVitestDependencies } from './addon-dependencies/addon-vitest';
import { DependencyCollector } from './dependency-collector';
import angularGenerator from './generators/ANGULAR';
import emberGenerator from './generators/EMBER';
import htmlGenerator from './generators/HTML';
import nextjsGenerator from './generators/NEXTJS';
import nuxtGenerator from './generators/NUXT';
import preactGenerator from './generators/PREACT';
import qwikGenerator from './generators/QWIK';
import reactGenerator from './generators/REACT';
import reactNativeGenerator from './generators/REACT_NATIVE';
import reactNativeWebGenerator from './generators/REACT_NATIVE_WEB';
import reactScriptsGenerator from './generators/REACT_SCRIPTS';
import serverGenerator from './generators/SERVER';
import solidGenerator from './generators/SOLID';
import svelteGenerator from './generators/SVELTE';
import svelteKitGenerator from './generators/SVELTEKIT';
import vue3Generator from './generators/VUE3';
import webComponentsGenerator from './generators/WEB-COMPONENTS';
import webpackReactGenerator from './generators/WEBPACK_REACT';
import type { CommandOptions, GeneratorFeature, GeneratorOptions } from './generators/types';
import { packageVersions } from './ink/steps/checks/packageVersions';
import { vitestConfigFiles } from './ink/steps/checks/vitestConfigFiles';
import { currentDirectoryIsEmpty, scaffoldNewProject } from './scaffold-new-project';

const ONBOARDING_PROJECT_TYPES = [
  ProjectType.REACT,
  ProjectType.REACT_SCRIPTS,
  ProjectType.REACT_NATIVE_WEB,
  ProjectType.REACT_PROJECT,
  ProjectType.WEBPACK_REACT,
  ProjectType.NEXTJS,
  ProjectType.VUE3,
  ProjectType.ANGULAR,
];

const installStorybook = async <Project extends ProjectType>(
  projectType: Project,
  packageManager: JsPackageManager,
  options: CommandOptions,
  dependencyCollector: DependencyCollector
): Promise<any> => {
  const npmOptions: NpmOptions = {
    type: 'devDependencies',
    skipInstall: options.skipInstall,
  };

  const language = await detectLanguage(packageManager as any);
  const pnp = await detectPnp();

  const generatorOptions: GeneratorOptions = {
    language,
    builder: options.builder as Builder,
    linkable: !!options.linkable,
    pnp: pnp || (options.usePnp as boolean),
    yes: options.yes as boolean,
    projectType,
    features: options.features || [],
    dependencyCollector,
  };

  const runGenerator: () => Promise<any> = async () => {
    switch (projectType) {
      case ProjectType.REACT_SCRIPTS:
        return reactScriptsGenerator(packageManager, npmOptions, generatorOptions);

      case ProjectType.REACT:
        return reactGenerator(packageManager, npmOptions, generatorOptions);

      case ProjectType.REACT_NATIVE: {
        return reactNativeGenerator(packageManager, npmOptions, generatorOptions);
      }

      case ProjectType.REACT_NATIVE_WEB: {
        return reactNativeWebGenerator(packageManager, npmOptions, generatorOptions);
      }

      case ProjectType.REACT_NATIVE_AND_RNW: {
        await reactNativeGenerator(packageManager, npmOptions, generatorOptions);
        return reactNativeWebGenerator(packageManager, npmOptions, generatorOptions);
      }

      case ProjectType.QWIK: {
        return qwikGenerator(packageManager, npmOptions, generatorOptions);
      }

      case ProjectType.WEBPACK_REACT:
        return webpackReactGenerator(packageManager, npmOptions, generatorOptions);

      case ProjectType.REACT_PROJECT:
        return reactGenerator(packageManager, npmOptions, generatorOptions);

      case ProjectType.NEXTJS:
        return nextjsGenerator(packageManager, npmOptions, generatorOptions);

      case ProjectType.VUE3:
        return vue3Generator(packageManager, npmOptions, generatorOptions);

      case ProjectType.NUXT:
        return nuxtGenerator(packageManager, npmOptions, generatorOptions);

      case ProjectType.ANGULAR:
        return angularGenerator(packageManager, npmOptions, generatorOptions, options);

      case ProjectType.EMBER:
        return emberGenerator(packageManager, npmOptions, generatorOptions);

      case ProjectType.HTML:
        return htmlGenerator(packageManager, npmOptions, generatorOptions);

      case ProjectType.WEB_COMPONENTS:
        return webComponentsGenerator(packageManager, npmOptions, generatorOptions);

      case ProjectType.PREACT:
        return preactGenerator(packageManager, npmOptions, generatorOptions);

      case ProjectType.SVELTE:
        return svelteGenerator(packageManager, npmOptions, generatorOptions);

      case ProjectType.SVELTEKIT:
        return svelteKitGenerator(packageManager, npmOptions, generatorOptions);

      case ProjectType.SERVER:
        return serverGenerator(packageManager, npmOptions, generatorOptions);

      case ProjectType.NX:
        throw new NxProjectDetectedError();

      case ProjectType.SOLID:
        return solidGenerator(packageManager, npmOptions, generatorOptions);

      case ProjectType.UNSUPPORTED:
        logger.log(`We detected a project type that we don't support yet.`);
        logger.log(
          `If you'd like your framework to be supported, please let use know about it at https://github.com/storybookjs/storybook/issues`
        );

        return Promise.resolve();

      default:
        logger.log(`We couldn't detect your project type. (code: ${projectType})`);
        logger.log(
          'You can specify a project type explicitly via `storybook init --type <type>`, see our docs on how to configure Storybook for your framework: https://storybook.js.org/docs/get-started/install'
        );

        return projectTypeInquirer(options, packageManager, dependencyCollector);
    }
  };

  try {
    return await runGenerator();
  } catch (err: any) {
    if (err?.message !== 'Canceled by the user' && err?.stack) {
      logger.error(`\n     ${picocolors.red(err.stack)}`);
    }
    throw new HandledError(err);
  }
};

const projectTypeInquirer = async (
  options: CommandOptions & { yes?: boolean },
  packageManager: JsPackageManager,
  dependencyCollector: DependencyCollector
) => {
  const manualAnswer = options.yes
    ? true
    : await prompt.confirm({
        message: 'Do you want to manually choose a Storybook project type to install?',
      });

  if (manualAnswer) {
    const manualFramework = await prompt.select({
      message: 'Please choose a project type from the following list:',
      options: installableProjectTypes.map((type) => ({
        label: type,
        value: type.toUpperCase(),
      })),
    });

    if (manualFramework) {
      return installStorybook(
        manualFramework as ProjectType,
        packageManager,
        options,
        dependencyCollector
      );
    }
  }

  logger.log('For more information about installing Storybook: https://storybook.js.org/docs');
  process.exit(0);
};

type InstallType = 'recommended' | 'light';

interface PromptOptions {
  skipPrompt?: boolean;
  disableTelemetry?: boolean;
  settings: Settings;
  projectType?: ProjectType;
}

/**
 * Prompt the user whether they are a new user and whether to include onboarding. Return whether or
 * not this is a new user.
 *
 * ```
 *  New to Storybook?
 *  > Yes: Help me with onboarding
 *    No: Skip onboarding & don't ask me again
 * ```
 */
export const promptNewUser = async ({
  settings,
  skipPrompt,
  disableTelemetry,
}: PromptOptions): Promise<boolean | undefined> => {
  const { skipOnboarding } = settings.value.init || {};

  if (!skipPrompt && !skipOnboarding) {
    const newUser = await prompt.select({
      message: 'New to Storybook?',
      options: [
        {
          label: `${picocolors.bold('Yes:')} Help me with onboarding`,
          value: true,
        },
        {
          label: `${picocolors.bold('No:')} Skip onboarding & don't ask again`,
          value: false,
        },
      ],
    });

    if (typeof newUser === 'undefined') {
      return newUser;
    }

    settings.value.init ||= {};
    settings.value.init.skipOnboarding = !newUser;
  } else {
    //  true if new user and not interactive, false if interactive
    settings.value.init ||= {};
    settings.value.init.skipOnboarding = !!skipOnboarding;
  }

  const newUser = !settings.value.init.skipOnboarding;
  if (!disableTelemetry) {
    await telemetry('init-step', {
      step: 'new-user-check',
      newUser,
    });
  }

  return newUser;
};

/**
 * Prompt the user to choose the configuration to install.
 *
 * ```
 * What configuration should we install?
 *  > Recommended: Component dev, docs, test
 *    Minimal: Dev only
 * ```
 */
export const promptInstallType = async ({
  skipPrompt,
  disableTelemetry,
  projectType,
}: PromptOptions): Promise<InstallType | undefined> => {
  let installType = 'recommended' as InstallType;
  if (!skipPrompt && projectType !== ProjectType.REACT_NATIVE) {
    const configuration = await prompt.select({
      message: 'What configuration should we install?',
      options: [
        {
          label: `${picocolors.bold('Recommended:')} Includes component development, docs, and testing features.`,
          value: 'recommended',
        },
        {
          label: `${picocolors.bold('Minimal:')} Just the essentials for component development.`,
          value: 'light',
        },
      ],
    });
    if (typeof configuration === 'undefined') {
      return configuration;
    }
    installType = configuration as InstallType;
  }
  if (!disableTelemetry) {
    await telemetry('init-step', { step: 'install-type', installType });
  }
  return installType;
};

export function getStorybookVersionFromAncestry(
  ancestry: ReturnType<typeof getProcessAncestry>
): string | undefined {
  for (const ancestor of ancestry.toReversed()) {
    const match = ancestor.command?.match(/\s(?:create-storybook|storybook)@([^\s]+)/);
    if (match) {
      return match[1];
    }
  }
  return undefined;
}

export function getCliIntegrationFromAncestry(
  ancestry: ReturnType<typeof getProcessAncestry>
): string | undefined {
  for (const ancestor of ancestry.toReversed()) {
    const match = ancestor.command?.match(/\s(sv(@[^ ]+)? create|sv(@[^ ]+)? add)/i);
    if (match) {
      return match[1].includes('add') ? 'sv add' : 'sv create';
    }
  }
  return undefined;
}

/**
 * Run preflight checks and setup
 *
 * - Handle empty directory and scaffold if needed
 * - Initialize package manager
 * - Install base dependencies if empty directory
 * - Check for existing Storybook installation
 */
async function runPreflightChecks(
  options: CommandOptions
): Promise<{ packageManager: JsPackageManager; isEmptyProject: boolean }> {
  const { packageManager: pkgMgr } = options;

  const isEmptyDirProject = options.force !== true && currentDirectoryIsEmpty();
  let packageManagerType = JsPackageManagerFactory.getPackageManagerType();

  // Check if the current directory is empty
  if (isEmptyDirProject) {
    // Initializing Storybook in an empty directory with yarn1
    // will very likely fail due to different kinds of hoisting issues
    // which doesn't get fixed anymore in yarn1.
    // We will fallback to npm in this case.
    if (packageManagerType === 'yarn1') {
      packageManagerType = 'npm';
    }

    // Prompt the user to create a new project from our list
    await scaffoldNewProject(packageManagerType, options);
    invalidateProjectRootCache();
  }

  const packageManager = JsPackageManagerFactory.getPackageManager({
    force: pkgMgr,
  });

  // Install base project dependencies if we scaffolded a new project
  if (isEmptyDirProject && !options.skipInstall) {
    await packageManager.installDependencies();
  }

  return { packageManager, isEmptyProject: isEmptyDirProject };
}

interface UserPreferences {
  newUser: boolean;
  installType: InstallType;
  selectedFeatures: Set<GeneratorFeature>;
}

/**
 * Get user preferences through interactive prompts
 *
 * - Show version info
 * - Prompt for new user / onboarding
 * - Prompt for install type (recommended vs minimal)
 * - Run feature compatibility checks
 */
async function getUserPreferences(
  options: CommandOptions,
  packageManager: JsPackageManager
): Promise<UserPreferences> {
  const currentVersion = versions.storybook;
  const latestVersion = (await packageManager.latestVersion('storybook'))!;
  const isPrerelease = prerelease(currentVersion);
  const isOutdated = lt(currentVersion, latestVersion);

  // Show version info
  logger.intro(CLI_COLORS.info(`Initializing Storybook`));

  if (isOutdated && !isPrerelease) {
    logger.warn(dedent`
      This version is behind the latest release, which is: ${picocolors.bold(latestVersion)}!
      You likely ran the init command through npx, which can use a locally cached version.
      
      To get the latest, please run: ${picocolors.bold('npx storybook@latest init')}
      You may want to CTRL+C to stop, and run with the latest version instead.
    `);
  } else if (isPrerelease) {
    logger.warn(`This is a pre-release version: ${picocolors.bold(currentVersion)}`);
  } else {
    logger.info(`Adding Storybook version ${picocolors.bold(currentVersion)} to your project`);
  }

  const isInteractive = process.stdout.isTTY && !isCI();

  const settings = await globalSettings();
  const promptOptions = {
    ...options,
    settings,
    skipPrompt: !isInteractive || options.yes,
    projectType: options.type,
  };

  const newUser = await promptNewUser(promptOptions);

  try {
    await settings.save();
  } catch (err) {
    logger.warn(`Failed to save user settings: ${err}`);
  }

  if (typeof newUser === 'undefined') {
    logger.log('Canceling...');
    process.exit(0);
  }

  let installType: InstallType = 'recommended';
  if (!newUser) {
    const install = await promptInstallType(promptOptions);
    if (typeof install === 'undefined') {
      logger.log('Canceling...');
      process.exit(0);
    }
    installType = install;
  }

  const selectedFeatures = new Set<GeneratorFeature>(options.features || []);
  if (installType === 'recommended') {
    selectedFeatures.add('docs');
    // Don't install in CI but install in non-TTY environments like agentic installs
    if (!isCI()) {
      selectedFeatures.add('test');
    }
    if (newUser) {
      selectedFeatures.add('onboarding');
    }
  }

  // Run feature compatibility checks
  if (selectedFeatures.has('test')) {
    const packageVersionsData = await packageVersions.condition({ packageManager }, {} as any);
    if (packageVersionsData.type === 'incompatible') {
      const ignorePackageVersions = isInteractive
        ? await prompt.confirm({
            message: dedent`
              ${packageVersionsData.reasons.join('\n')}
              Do you want to continue without Storybook's testing features?
            `,
          })
        : true;

      if (ignorePackageVersions) {
        selectedFeatures.delete('test');
      } else {
        process.exit(0);
      }
    }

    const vitestConfigFilesData = await vitestConfigFiles.condition(
      { babel, empathic: find, fs } as any,
      { directory: process.cwd() } as any
    );
    if (vitestConfigFilesData.type === 'incompatible') {
      const ignoreVitestConfigFiles = isInteractive
        ? await prompt.confirm({
            message: dedent`
              ${vitestConfigFilesData.reasons.join('\n')}
              Do you want to continue without Storybook's testing features?
            `,
          })
        : true;

      if (ignoreVitestConfigFiles) {
        selectedFeatures.delete('test');
      } else {
        process.exit(0);
      }
    }
  }

  return { newUser, installType, selectedFeatures };
}

/**
 * Detect project type
 *
 * - Auto-detect or use user-provided type
 * - Handle React Native variant selection
 */
async function runDetection(
  options: CommandOptions,
  packageManager: JsPackageManager
): Promise<ProjectType> {
  let projectType: ProjectType;
  const projectTypeProvided = options.type;

  const task = prompt.taskLog({
    id: 'detect-project',
    title: projectTypeProvided
      ? `Installing Storybook for user specified project type: ${projectTypeProvided}`
      : 'Detecting project type...',
  });

  if (projectTypeProvided) {
    if (installableProjectTypes.includes(projectTypeProvided)) {
      projectType = projectTypeProvided.toUpperCase() as ProjectType;
    } else {
      task.error(
        `The provided project type was not recognized by Storybook: ${projectTypeProvided}`
      );
      logger.log(`\nThe project types currently supported by Storybook are:\n`);
      installableProjectTypes.sort().forEach((framework) => logger.log(`  - ${framework}`));
      logger.log('');
      throw new HandledError(`Unknown project type supplied: ${projectTypeProvided}`);
    }
  } else {
    try {
      projectType = (await detect(packageManager as any, options)) as ProjectType;

      if (projectType === ProjectType.REACT_NATIVE && !options.yes) {
        const manualType = await prompt.select({
          message: "We've detected a React Native project. Install:",
          options: [
            {
              label: `${picocolors.bold('React Native')}: Storybook on your device/simulator`,
              value: ProjectType.REACT_NATIVE,
            },
            {
              label: `${picocolors.bold('React Native Web')}: Storybook on web for docs, test, and sharing`,
              value: ProjectType.REACT_NATIVE_WEB,
            },
            {
              label: `${picocolors.bold('Both')}: Add both native and web Storybooks`,
              value: ProjectType.REACT_NATIVE_AND_RNW,
            },
          ],
        });
        projectType = manualType as ProjectType;
      }
    } catch (err) {
      task.error(String(err));
      throw new HandledError(err);
    }
  }

  task.success(`Detected project type: ${projectType}`);

  // Check for existing installation
  const storybookInstantiated = isStorybookInstantiated();

  if (options.force === false && storybookInstantiated && projectType !== ProjectType.ANGULAR) {
    const force = await prompt.confirm({
      message:
        'We found a .storybook config directory in your project. Therefore we assume that Storybook is already instantiated for your project. Do you still want to continue and force the initialization?',
    });

    if (force) {
      options.force = true;
    } else {
      process.exit(0);
    }
  }

  return projectType;
}

/**
 * Execute the generator for the detected project type
 *
 * - Run the appropriate generator with dependency collector
 * - Collect addon dependencies (vitest, a11y) without installing
 */
async function executeGenerator(
  projectType: ProjectType,
  packageManager: JsPackageManager,
  options: CommandOptions,
  selectedFeatures: Set<GeneratorFeature>,
  dependencyCollector: DependencyCollector
): Promise<{ installResult: any; storybookCommand: string }> {
  // Filter onboarding feature based on project type support
  if (selectedFeatures.has('onboarding') && !ONBOARDING_PROJECT_TYPES.includes(projectType)) {
    selectedFeatures.delete('onboarding');
  }

  // Update options with final selected features
  options.features = Array.from(selectedFeatures);

  // Collect addon dependencies for test feature
  if (selectedFeatures.has('test')) {
    try {
      // Determine framework package name for Next.js detection
      const frameworkPackageName =
        projectType === ProjectType.NEXTJS ? '@storybook/nextjs' : undefined;

      const vitestDeps = await getAddonVitestDependencies(packageManager, frameworkPackageName);
      const a11yDeps = getAddonA11yDependencies();

      dependencyCollector.addDevDependencies([...vitestDeps, ...a11yDeps]);
    } catch (err) {
      logger.warn(`Failed to collect addon dependencies: ${err}`);
    }
  }

  // Generator handles its own logging with ora spinners
  const installResult = await installStorybook(
    projectType as ProjectType,
    packageManager,
    options,
    dependencyCollector
  );

  // Sync features back because they may have been mutated by the generator
  Object.assign(selectedFeatures, new Set(options.features));

  const storybookCommand =
    projectType === ProjectType.ANGULAR
      ? `ng run ${installResult.projectName}:storybook`
      : packageManager.getRunCommand('storybook');

  return { installResult, storybookCommand };
}

/**
 * Install all collected dependencies in a single operation
 *
 * - Update package.json with all dependencies
 * - Run single install command
 */
async function installAllDependencies(
  packageManager: JsPackageManager,
  dependencyCollector: DependencyCollector,
  options: CommandOptions
): Promise<void> {
  if (!dependencyCollector.hasPackages() && options.skipInstall) {
    return;
  }

  try {
    // Update package.json with all collected dependencies
    const { dependencies, devDependencies } = dependencyCollector.getAllPackages();

    if (dependencies.length > 0) {
      await packageManager.addDependencies(
        { type: 'dependencies', skipInstall: true },
        dependencies
      );
    }

    if (devDependencies.length > 0) {
      await packageManager.addDependencies(
        { type: 'devDependencies', skipInstall: true },
        devDependencies
      );
    }

    // Run single installation
    if (!options.skipInstall) {
      await packageManager.installDependencies();
    }
  } catch (err) {
    throw err;
  }
}

/**
 * Run addon postinstall scripts for configuration
 *
 * - Executes postinstall scripts with skipInstall flag
 * - Configures addons without triggering additional installations
 */
async function configureAddons(
  packageManager: JsPackageManager,
  selectedFeatures: Set<GeneratorFeature>,
  dependencyCollector: DependencyCollector,
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
    // Import postinstallAddon from cli-storybook package
    const { postinstallAddon } = await import('../../cli-storybook/src/postinstallAddon');
    const configDir = '.storybook';

    // Run a11y addon postinstall (runs automigration)
    const addons = await packageManager.getVersionedPackages([
      '@storybook/addon-a11y',
      '@storybook/addon-vitest',
    ]);

    dependencyCollector.addDevDependencies(addons);

    await postinstallAddon('@storybook/addon-a11y', {
      packageManager: packageManager.type,
      configDir,
      yes: options.yes,
      skipInstall: true,
      skipDependencyManagement: true,
    });

    // Run vitest addon postinstall (configuration only, dependencies already collected)
    await postinstallAddon('@storybook/addon-vitest', {
      packageManager: packageManager.type,
      configDir,
      yes: options.yes,
      skipInstall: true,
      skipDependencyManagement: true,
    });

    task.success('Test addons configured');
  } catch (err) {
    task.error(`Failed to configure test addons: ${String(err)}`);
    // Don't throw - addon configuration failures shouldn't fail the entire init
  }
}

/** Print final summary and update .gitignore */
async function printFinalSummary(
  projectType: ProjectType,
  selectedFeatures: Set<GeneratorFeature>,
  storybookCommand: string
): Promise<void> {
  // Update .gitignore
  const foundGitIgnoreFile = find.up('.gitignore');
  const rootDirectory = getProjectRoot();

  if (foundGitIgnoreFile && foundGitIgnoreFile.includes(rootDirectory)) {
    const contents = await fs.readFile(foundGitIgnoreFile, 'utf-8');
    const hasStorybookLog = contents.includes('*storybook.log');
    const hasStorybookStatic = contents.includes('storybook-static');
    const linesToAdd = [
      !hasStorybookLog ? '*storybook.log' : '',
      !hasStorybookStatic ? 'storybook-static' : '',
    ]
      .filter(Boolean)
      .join('\n');

    if (linesToAdd) {
      await fs.appendFile(foundGitIgnoreFile, `\n${linesToAdd}\n`);
    }
  }

  // Print success message
  const printFeatures = (features: Set<GeneratorFeature>) =>
    Array.from(features).join(', ') || 'none';

  logger.step(CLI_COLORS.success('Storybook was successfully installed in your project!'));

  logger.log(
    dedent`
      Additional features: ${printFeatures(selectedFeatures)}

      To run Storybook manually, run ${CLI_COLORS.cta(storybookCommand)}. CTRL+C to stop.

      Wanna know more about Storybook? Check out ${CLI_COLORS.cta('https://storybook.js.org/')}
      Having trouble or want to chat? Join us at ${CLI_COLORS.cta('https://discord.gg/storybook/')}
    `
  );

  logger.outro('');
}

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
  // 1. Run preflight checks
  const { packageManager } = await runPreflightChecks(options);

  // 2. Get user preferences and feature selections
  const { newUser, selectedFeatures } = await getUserPreferences(options, packageManager);

  // 3. Detect project type
  const projectType = await runDetection(options, packageManager);

  // Get telemetry info
  let versionSpecifier: string | undefined;
  let cliIntegration: string | undefined;
  try {
    const ancestry = getProcessAncestry();
    versionSpecifier = getStorybookVersionFromAncestry(ancestry);
    cliIntegration = getCliIntegrationFromAncestry(ancestry);
  } catch {
    //
  }

  // Send telemetry
  const telemetryFeatures = {
    dev: true,
    docs: selectedFeatures.has('docs'),
    test: selectedFeatures.has('test'),
    onboarding: selectedFeatures.has('onboarding'),
  };

  if (!options.disableTelemetry) {
    await telemetry('init', {
      projectType,
      features: telemetryFeatures,
      newUser,
      versionSpecifier,
      cliIntegration,
    });
  }

  // Handle React Native special case
  if ([ProjectType.REACT_NATIVE, ProjectType.REACT_NATIVE_AND_RNW].includes(projectType)) {
    logger.log(dedent`
      ${CLI_COLORS.warning('React Native (RN) Storybook installation is not 100% automated.')}

      To run RN Storybook, you will need to:

      1. Replace the contents of your app entry with the following

      ${picocolors.inverse(' ' + "export {default} from './.rnstorybook';" + ' ')}

      2. Wrap your metro config with the withStorybook enhancer function like this:

      ${picocolors.inverse(' ' + "const withStorybook = require('@storybook/react-native/metro/withStorybook');" + ' ')}
      ${picocolors.inverse(' ' + 'module.exports = withStorybook(defaultConfig);' + ' ')}

      For more details go to:
      ${CLI_COLORS.cta('https://github.com/storybookjs/react-native#getting-started')}

      Then to start RN Storybook, run:

      ${picocolors.inverse(' ' + packageManager.getRunCommand('start') + ' ')}
    `);

    if (projectType === ProjectType.REACT_NATIVE_AND_RNW) {
      logger.log(dedent`

        ${CLI_COLORS.warning('React Native Web (RNW) Storybook is fully installed.')}

        To start RNW Storybook, run:

        ${picocolors.inverse(' ' + packageManager.getRunCommand('storybook') + ' ')}
      `);
    }
    return { shouldRunDev: false };
  }

  // 4. Execute generator with dependency collector
  const dependencyCollector = new DependencyCollector();

  const { storybookCommand } = await executeGenerator(
    projectType,
    packageManager,
    options,
    selectedFeatures,
    dependencyCollector
  );

  // 5. Configure addons (run postinstall scripts for configuration only)
  await configureAddons(packageManager, selectedFeatures, dependencyCollector, options);

  // 6. Install all dependencies in a single operation
  await installAllDependencies(packageManager, dependencyCollector, options);

  // 7. Print final summary
  await printFinalSummary(projectType, selectedFeatures, storybookCommand);

  return {
    shouldRunDev: !!options.dev && !options.skipInstall,
    shouldOnboard: newUser,
    projectType,
    packageManager,
    storybookCommand,
  };
}

export async function initiate(options: CommandOptions): Promise<void> {
  const initiateResult = await withTelemetry(
    'init',
    {
      cliOptions: options,
      printError: (err) => !err.handled && logger.error(err),
    },
    () => {
      return doInitiate(options);
    }
  );

  if (initiateResult?.shouldRunDev) {
    const { projectType, packageManager, storybookCommand } = initiateResult;
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

      if (supportsOnboarding && initiateResult.shouldOnboard) {
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
      // Do nothing here, as the command above will spawn a `storybook dev` process which does the error handling already. Else, the error will get bubbled up and sent to crash reports twice
    }
  }
}
