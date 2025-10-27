import { execSync } from 'node:child_process';
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
  commandLog,
  getProjectRoot,
  invalidateProjectRootCache,
  isCI,
  paddedLog,
  versions,
} from 'storybook/internal/common';
import { withTelemetry } from 'storybook/internal/core-server';
import { deprecate, logger } from 'storybook/internal/node-logger';
import { NxProjectDetectedError } from 'storybook/internal/server-errors';
import { telemetry } from 'storybook/internal/telemetry';

import boxen from 'boxen';
import * as find from 'empathic/find';
import picocolors from 'picocolors';
import { getProcessAncestry } from 'process-ancestry';
import prompts from 'prompts';
import { lt, prerelease } from 'semver';
import { dedent } from 'ts-dedent';

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
  options: CommandOptions
): Promise<any> => {
  const npmOptions: NpmOptions = {
    type: 'devDependencies',
    skipInstall: options.skipInstall,
  };

  const language = await detectLanguage(packageManager as any);

  // TODO: Evaluate if this is correct after removing pnp compatibility code in SB11
  const pnp = await detectPnp();
  if (pnp) {
    deprecate(dedent`
      As of Storybook 10.0, PnP is deprecated.
      If you are using PnP, you can continue to use Storybook 10.0, but we recommend migrating to a different package manager or linker-mode.

      In future versions, PnP compatibility will be removed.
    `);
  }

  const generatorOptions: GeneratorOptions = {
    language,
    builder: options.builder as Builder,
    linkable: !!options.linkable,
    pnp: pnp || (options.usePnp as boolean),
    yes: options.yes as boolean,
    projectType,
    features: options.features || [],
  };

  const runGenerator: () => Promise<any> = async () => {
    switch (projectType) {
      case ProjectType.REACT_SCRIPTS:
        return reactScriptsGenerator(packageManager, npmOptions, generatorOptions).then(
          commandLog('Adding Storybook support to your "Create React App" based project')
        );

      case ProjectType.REACT:
        return reactGenerator(packageManager, npmOptions, generatorOptions).then(
          commandLog('Adding Storybook support to your "React" app')
        );

      case ProjectType.REACT_NATIVE: {
        return reactNativeGenerator(packageManager, npmOptions, generatorOptions).then(
          commandLog('Adding Storybook support to your "React Native" app')
        );
      }

      case ProjectType.REACT_NATIVE_WEB: {
        return reactNativeWebGenerator(packageManager, npmOptions, generatorOptions).then(
          commandLog('Adding Storybook support to your "React Native" app')
        );
      }

      case ProjectType.REACT_NATIVE_AND_RNW: {
        commandLog('Adding Storybook support to your "React Native" app');
        await reactNativeGenerator(packageManager, npmOptions, generatorOptions);
        return reactNativeWebGenerator(packageManager, npmOptions, generatorOptions);
      }

      case ProjectType.QWIK: {
        return qwikGenerator(packageManager, npmOptions, generatorOptions).then(
          commandLog('Adding Storybook support to your "Qwik" app')
        );
      }

      case ProjectType.WEBPACK_REACT:
        return webpackReactGenerator(packageManager, npmOptions, generatorOptions).then(
          commandLog('Adding Storybook support to your "Webpack React" app')
        );

      case ProjectType.REACT_PROJECT:
        return reactGenerator(packageManager, npmOptions, generatorOptions).then(
          commandLog('Adding Storybook support to your "React" library')
        );

      case ProjectType.NEXTJS:
        return nextjsGenerator(packageManager, npmOptions, generatorOptions).then(
          commandLog('Adding Storybook support to your "Next" app')
        );

      case ProjectType.VUE3:
        return vue3Generator(packageManager, npmOptions, generatorOptions).then(
          commandLog('Adding Storybook support to your "Vue 3" app')
        );

      case ProjectType.NUXT:
        return nuxtGenerator(packageManager, npmOptions, generatorOptions).then(
          commandLog('Adding Storybook support to your "Nuxt" app')
        );

      case ProjectType.ANGULAR:
        commandLog('Adding Storybook support to your "Angular" app');
        return angularGenerator(packageManager, npmOptions, generatorOptions, options);

      case ProjectType.EMBER:
        return emberGenerator(packageManager, npmOptions, generatorOptions).then(
          commandLog('Adding Storybook support to your "Ember" app')
        );

      case ProjectType.HTML:
        return htmlGenerator(packageManager, npmOptions, generatorOptions).then(
          commandLog('Adding Storybook support to your "HTML" app')
        );

      case ProjectType.WEB_COMPONENTS:
        return webComponentsGenerator(packageManager, npmOptions, generatorOptions).then(
          commandLog('Adding Storybook support to your "web components" app')
        );

      case ProjectType.PREACT:
        return preactGenerator(packageManager, npmOptions, generatorOptions).then(
          commandLog('Adding Storybook support to your "Preact" app')
        );

      case ProjectType.SVELTE:
        return svelteGenerator(packageManager, npmOptions, generatorOptions).then(
          commandLog('Adding Storybook support to your "Svelte" app')
        );

      case ProjectType.SVELTEKIT:
        return svelteKitGenerator(packageManager, npmOptions, generatorOptions).then(
          commandLog('Adding Storybook support to your "SvelteKit" app')
        );

      case ProjectType.SERVER:
        return serverGenerator(packageManager, npmOptions, generatorOptions).then(
          commandLog('Adding Storybook support to your "Server" app')
        );

      case ProjectType.NX:
        throw new NxProjectDetectedError();

      case ProjectType.SOLID:
        return solidGenerator(packageManager, npmOptions, generatorOptions).then(
          commandLog('Adding Storybook support to your "SolidJS" app')
        );

      case ProjectType.UNSUPPORTED:
        paddedLog(`We detected a project type that we don't support yet.`);
        paddedLog(
          `If you'd like your framework to be supported, please let use know about it at https://github.com/storybookjs/storybook/issues`
        );

        // Add a new line for the clear visibility.
        logger.log('');

        return Promise.resolve();

      default:
        paddedLog(`We couldn't detect your project type. (code: ${projectType})`);
        paddedLog(
          'You can specify a project type explicitly via `storybook init --type <type>`, see our docs on how to configure Storybook for your framework: https://storybook.js.org/docs/get-started/install'
        );

        // Add a new line for the clear visibility.
        logger.log('');

        return projectTypeInquirer(options, packageManager);
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
  packageManager: JsPackageManager
) => {
  const manualAnswer = options.yes
    ? true
    : await prompts([
        {
          type: 'confirm',
          name: 'manual',
          message: 'Do you want to manually choose a Storybook project type to install?',
          initial: true,
        },
      ]);

  if (manualAnswer !== true && manualAnswer.manual) {
    const { manualFramework } = await prompts([
      {
        type: 'select',
        name: 'manualFramework',
        message: 'Please choose a project type from the following list:',
        choices: installableProjectTypes.map((type) => ({
          title: type,
          value: type.toUpperCase(),
        })),
      },
    ]);

    if (manualFramework) {
      return installStorybook(manualFramework, packageManager, options);
    }
  }

  logger.log('');
  logger.log('For more information about installing Storybook: https://storybook.js.org/docs');
  process.exit(0);
};

interface PromptOptions {
  skipPrompt?: boolean;
  disableTelemetry?: boolean;
  settings: Settings;
  projectType?: ProjectType;
}

type InstallType = 'recommended' | 'light';

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
    const { newUser } = await prompts({
      type: 'select',
      name: 'newUser',
      message: 'New to Storybook?',
      choices: [
        {
          title: `${picocolors.bold('Yes:')} Help me with onboarding`,
          value: true,
        },
        {
          title: `${picocolors.bold('No:')} Skip onboarding & don't ask again`,
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
    const { configuration } = await prompts({
      type: 'select',
      name: 'configuration',
      message: 'What configuration should we install?',
      choices: [
        {
          title: `${picocolors.bold('Recommended:')} Component dev, docs, test`,
          value: 'recommended',
        },
        {
          title: `${picocolors.bold('Minimal:')} Component dev only`,
          value: 'light',
        },
      ],
    });
    if (typeof configuration === 'undefined') {
      return configuration;
    }
    installType = configuration;
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
  const { packageManager: pkgMgr } = options;

  const isEmptyDirProject = options.force !== true && currentDirectoryIsEmpty();
  let packageManagerType = JsPackageManagerFactory.getPackageManagerType();

  // Check if the current directory is empty.
  if (isEmptyDirProject) {
    // Initializing Storybook in an empty directory with yarn1
    // will very likely fail due to different kinds of hoisting issues
    // which doesn't get fixed anymore in yarn1.
    // We will fallback to npm in this case.
    if (packageManagerType === 'yarn1') {
      packageManagerType = 'npm';
    }

    // Prompt the user to create a new project from our list.
    await scaffoldNewProject(packageManagerType, options);
    invalidateProjectRootCache();
  }

  const packageManager = JsPackageManagerFactory.getPackageManager({
    force: pkgMgr,
  });

  if (!options.skipInstall) {
    await packageManager.installDependencies();
  }

  const latestVersion = (await packageManager.latestVersion('storybook'))!;
  const currentVersion = versions.storybook;
  const isPrerelease = prerelease(currentVersion);
  const isOutdated = lt(currentVersion, latestVersion);
  const borderColor = isOutdated ? '#FC521F' : '#F1618C';
  let versionSpecifier = undefined;
  let cliIntegration = undefined;
  try {
    const ancestry = getProcessAncestry();
    versionSpecifier = getStorybookVersionFromAncestry(ancestry);
    cliIntegration = getCliIntegrationFromAncestry(ancestry);
  } catch (err) {
    //
  }

  const messages = {
    welcome: `Adding Storybook version ${picocolors.bold(currentVersion)} to your project..`,
    notLatest: picocolors.red(dedent`
      This version is behind the latest release, which is: ${picocolors.bold(latestVersion)}!
      You likely ran the init command through npx, which can use a locally cached version, to get the latest please run:
      ${picocolors.bold('npx storybook@latest init')}

      You may want to CTRL+C to stop, and run with the latest version instead.
    `),
    prelease: picocolors.yellow('This is a pre-release version.'),
  };

  logger.log(
    boxen(
      [messages.welcome]
        .concat(isOutdated && !isPrerelease ? [messages.notLatest] : [])
        .concat(isPrerelease ? [messages.prelease] : [])
        .join('\n'),
      { borderStyle: 'round', padding: 1, borderColor }
    )
  );

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
    logger.log('canceling');
    process.exit(0);
  }

  let installType = 'recommended' as InstallType;
  if (!newUser) {
    const install = await promptInstallType(promptOptions);
    if (typeof install === 'undefined') {
      logger.log('canceling');
      process.exit(0);
    }
    installType = install;
  }

  let selectedFeatures = new Set<GeneratorFeature>(options.features || []);
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

  const telemetryFeatures = {
    dev: true,
    docs: selectedFeatures.has('docs'),
    test: selectedFeatures.has('test'),
    onboarding: selectedFeatures.has('onboarding'),
  };

  let projectType: ProjectType;
  const projectTypeProvided = options.type;
  const infoText = projectTypeProvided
    ? `Installing Storybook for user specified project type: ${projectTypeProvided}`
    : 'Detecting project type';
  const done = commandLog(infoText);

  if (projectTypeProvided) {
    if (installableProjectTypes.includes(projectTypeProvided)) {
      projectType = projectTypeProvided.toUpperCase() as ProjectType;
    } else {
      done(`The provided project type was not recognized by Storybook: ${projectTypeProvided}`);
      logger.log(`\nThe project types currently supported by Storybook are:\n`);
      installableProjectTypes.sort().forEach((framework) => paddedLog(`- ${framework}`));
      logger.log('');
      throw new HandledError(`Unknown project type supplied: ${projectTypeProvided}`);
    }
  } else {
    try {
      projectType = (await detect(packageManager as any, options)) as ProjectType;

      if (projectType === ProjectType.REACT_NATIVE && !options.yes) {
        const { manualType } = await prompts({
          type: 'select',
          name: 'manualType',
          message: "We've detected a React Native project. Install:",
          choices: [
            {
              title: `${picocolors.bold('React Native')}: Storybook on your device/simulator`,
              value: ProjectType.REACT_NATIVE,
            },
            {
              title: `${picocolors.bold('React Native Web')}: Storybook on web for docs, test, and sharing`,
              value: ProjectType.REACT_NATIVE_WEB,
            },
            {
              title: `${picocolors.bold('Both')}: Add both native and web Storybooks`,
              value: ProjectType.REACT_NATIVE_AND_RNW,
            },
          ],
        });
        projectType = manualType;
      }
    } catch (err) {
      console.log(err);
      done(String(err));
      throw new HandledError(err);
    }
  }
  done();

  const storybookInstantiated = isStorybookInstantiated();

  if (options.force === false && storybookInstantiated && projectType !== ProjectType.ANGULAR) {
    logger.log('');
    const { force } = await prompts([
      {
        type: 'confirm',
        name: 'force',
        message:
          'We found a .storybook config directory in your project. Therefore we assume that Storybook is already instantiated for your project. Do you still want to continue and force the initialization?',
      },
    ]);
    logger.log('');

    if (force) {
      options.force = true;
    } else {
      process.exit(0);
    }
  }

  if (selectedFeatures.has('test')) {
    const packageVersionsData = await packageVersions.condition({ packageManager }, {} as any);
    if (packageVersionsData.type === 'incompatible') {
      const { ignorePackageVersions } = isInteractive
        ? await prompts([
            {
              type: 'confirm',
              name: 'ignorePackageVersions',
              message: dedent`
                ${packageVersionsData.reasons.join('\n')}
                Do you want to continue without Storybook's testing features?
              `,
            },
          ])
        : { ignorePackageVersions: true };
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
      const { ignoreVitestConfigFiles } = isInteractive
        ? await prompts([
            {
              type: 'confirm',
              name: 'ignoreVitestConfigFiles',
              message: dedent`
                ${vitestConfigFilesData.reasons.join('\n')}
                Do you want to continue without Storybook's testing features?
              `,
            },
          ])
        : { ignoreVitestConfigFiles: true };
      if (ignoreVitestConfigFiles) {
        selectedFeatures.delete('test');
      } else {
        process.exit(0);
      }
    }
  }

  if (selectedFeatures.has('onboarding') && !ONBOARDING_PROJECT_TYPES.includes(projectType)) {
    selectedFeatures.delete('onboarding');
  }

  // Update the options object with the selected features before passing it down to the generator
  options.features = Array.from(selectedFeatures);

  const installResult = await installStorybook(projectType as ProjectType, packageManager, options);

  // Sync features back because they may have been mutated by the generator (e.g. in case of undetected project type)
  selectedFeatures = new Set(options.features);

  if (!options.skipInstall) {
    await packageManager.installDependencies();
  }

  if (!options.disableTelemetry) {
    await telemetry('init', {
      projectType,
      features: telemetryFeatures,
      newUser,
      versionSpecifier,
      cliIntegration,
    });
  }

  if ([ProjectType.REACT_NATIVE, ProjectType.REACT_NATIVE_AND_RNW].includes(projectType)) {
    logger.log(dedent`
      ${picocolors.yellow('React Native (RN) Storybook installation is not 100% automated.')}

      To run RN Storybook, you will need to:

      1. Replace the contents of your app entry with the following

      ${picocolors.inverse(' ' + "export {default} from './.rnstorybook';" + ' ')}

      2. Wrap your metro config with the withStorybook enhancer function like this:

      ${picocolors.inverse(' ' + "const withStorybook = require('@storybook/react-native/metro/withStorybook');" + ' ')}
      ${picocolors.inverse(' ' + 'module.exports = withStorybook(defaultConfig);' + ' ')}

      For more details go to:
      ${picocolors.cyan('https://github.com/storybookjs/react-native#getting-started')}

      Then to start RN Storybook, run:

      ${picocolors.inverse(' ' + packageManager.getRunCommand('start') + ' ')}
    `);

    if (projectType === ProjectType.REACT_NATIVE_AND_RNW) {
      logger.log(dedent`

        ${picocolors.yellow('React Native Web (RNW) Storybook is fully installed.')}

        To start RNW Storybook, run:

        ${picocolors.inverse(' ' + packageManager.getRunCommand('storybook') + ' ')}
      `);
    }
    return { shouldRunDev: false };
  }

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

  const storybookCommand =
    projectType === ProjectType.ANGULAR
      ? `ng run ${installResult.projectName}:storybook`
      : packageManager.getRunCommand('storybook');

  if (selectedFeatures.has('test')) {
    const flags = ['--yes', options.skipInstall && '--skip-install'].filter(Boolean).join(' ');
    logger.log(
      `> npx storybook@${versions.storybook} add ${flags} @storybook/addon-a11y@${versions['@storybook/addon-a11y']}`
    );
    execSync(
      `npx storybook@${versions.storybook} add ${flags} @storybook/addon-a11y@${versions['@storybook/addon-a11y']}`,
      { cwd: process.cwd(), stdio: 'inherit' }
    );
    logger.log(
      `> npx storybook@${versions.storybook} add ${flags} @storybook/addon-vitest@${versions['@storybook/addon-vitest']}`
    );
    execSync(
      `npx storybook@${versions.storybook} add ${flags} @storybook/addon-vitest@${versions['@storybook/addon-vitest']}`,
      { cwd: process.cwd(), stdio: 'inherit' }
    );
  }

  const printFeatures = (features: Set<GeneratorFeature>) =>
    Array.from(features).join(', ') || 'none';

  logger.log(
    boxen(
      dedent`
          Storybook was successfully installed in your project! 🎉
          Additional features: ${printFeatures(selectedFeatures)}

          To run Storybook manually, run ${picocolors.yellow(
            picocolors.bold(storybookCommand)
          )}. CTRL+C to stop.

          Wanna know more about Storybook? Check out ${picocolors.cyan('https://storybook.js.org/')}
          Having trouble or want to chat? Join us at ${picocolors.cyan(
            'https://discord.gg/storybook/'
          )}
        `,
      { borderStyle: 'round', padding: 1, borderColor: '#F1618C' }
    )
  );

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
    () => doInitiate(options)
  );

  if (initiateResult?.shouldRunDev) {
    const { projectType, packageManager, storybookCommand } = initiateResult;
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
    } catch (e) {
      // Do nothing here, as the command above will spawn a `storybook dev` process which does the error handling already. Else, the error will get bubbled up and sent to crash reports twice
    }
  }
}
