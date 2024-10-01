import { appendFile, readFile } from 'node:fs/promises';

import type { Builder, NpmOptions } from 'storybook/internal/cli';
import { ProjectType, installableProjectTypes } from 'storybook/internal/cli';
import { detect, detectLanguage, detectPnp, isStorybookInstantiated } from 'storybook/internal/cli';
import {
  HandledError,
  JsPackageManagerFactory,
  commandLog,
  getProjectRoot,
  paddedLog,
  versions,
} from 'storybook/internal/common';
import type { JsPackageManager } from 'storybook/internal/common';
import { withTelemetry } from 'storybook/internal/core-server';
import { NxProjectDetectedError } from 'storybook/internal/server-errors';
import { telemetry } from 'storybook/internal/telemetry';

import boxen from 'boxen';
import findUp from 'find-up';
import picocolors from 'picocolors';
import prompts from 'prompts';
import { lt, prerelease } from 'semver';
import { dedent } from 'ts-dedent';

import angularGenerator from './generators/ANGULAR';
import emberGenerator from './generators/EMBER';
import htmlGenerator from './generators/HTML';
import nextjsGenerator from './generators/NEXTJS';
import preactGenerator from './generators/PREACT';
import qwikGenerator from './generators/QWIK';
import reactGenerator from './generators/REACT';
import reactNativeGenerator from './generators/REACT_NATIVE';
import reactScriptsGenerator from './generators/REACT_SCRIPTS';
import serverGenerator from './generators/SERVER';
import solidGenerator from './generators/SOLID';
import svelteGenerator from './generators/SVELTE';
import svelteKitGenerator from './generators/SVELTEKIT';
import vue3Generator from './generators/VUE3';
import webComponentsGenerator from './generators/WEB-COMPONENTS';
import webpackReactGenerator from './generators/WEBPACK_REACT';
import type { CommandOptions, GeneratorOptions } from './generators/types';
import { currentDirectoryIsEmpty, scaffoldNewProject } from './scaffold-new-project';

const logger = console;

const installStorybook = async <Project extends ProjectType>(
  projectType: Project,
  packageManager: JsPackageManager,
  options: CommandOptions
): Promise<any> => {
  const npmOptions: NpmOptions = {
    installAsDevDependencies: true,
    skipInstall: options.skipInstall,
  };

  const language = await detectLanguage(packageManager);
  const pnp = await detectPnp();

  const generatorOptions: GeneratorOptions = {
    language,
    builder: options.builder as Builder,
    linkable: !!options.linkable,
    pnp: pnp || (options.usePnp as boolean),
    yes: options.yes as boolean,
    projectType,
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
        return reactNativeGenerator(packageManager, npmOptions).then(
          commandLog('Adding Storybook support to your "React Native" app')
        );
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
        logger.log();

        return Promise.resolve();

      default:
        paddedLog(`We couldn't detect your project type. (code: ${projectType})`);
        paddedLog(
          'You can specify a project type explicitly via `storybook init --type <type>`, see our docs on how to configure Storybook for your framework: https://storybook.js.org/docs/react/get-started/install'
        );

        // Add a new line for the clear visibility.
        logger.log();

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

  logger.log();
  logger.log('For more information about installing Storybook: https://storybook.js.org/docs');
  process.exit(0);
};

export async function doInitiate(options: CommandOptions): Promise<
  | {
      shouldRunDev: true;
      projectType: ProjectType;
      packageManager: JsPackageManager;
      storybookCommand: string;
    }
  | { shouldRunDev: false }
> {
  const { packageManager: pkgMgr } = options;

  let packageManager = JsPackageManagerFactory.getPackageManager({
    force: pkgMgr,
  });

  const latestVersion = await packageManager.latestVersion('storybook');
  const currentVersion = versions.storybook;
  const isPrerelease = prerelease(currentVersion);
  const isOutdated = lt(currentVersion, latestVersion);
  const borderColor = isOutdated ? '#FC521F' : '#F1618C';

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

  // Check if the current directory is empty.
  if (options.force !== true && currentDirectoryIsEmpty(packageManager.type)) {
    // Initializing Storybook in an empty directory with yarn1
    // will very likely fail due to different kind of hoisting issues
    // which doesn't get fixed anymore in yarn1.
    // We will fallback to npm in this case.
    if (packageManager.type === 'yarn1') {
      packageManager = JsPackageManagerFactory.getPackageManager({ force: 'npm' });
    }
    // Prompt the user to create a new project from our list.
    await scaffoldNewProject(packageManager.type, options);
  }

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
      logger.log();
      throw new HandledError(`Unknown project type supplied: ${projectTypeProvided}`);
    }
  } else {
    try {
      projectType = (await detect(packageManager, options)) as ProjectType;
    } catch (err) {
      done(String(err));
      throw new HandledError(err);
    }
  }
  done();

  const storybookInstantiated = isStorybookInstantiated();

  if (options.force === false && storybookInstantiated && projectType !== ProjectType.ANGULAR) {
    logger.log();
    const { force } = await prompts([
      {
        type: 'confirm',
        name: 'force',
        message:
          'We found a .storybook config directory in your project. Therefore we assume that Storybook is already instantiated for your project. Do you still want to continue and force the initialization?',
      },
    ]);
    logger.log();

    if (force) {
      options.force = true;
    } else {
      process.exit(0);
    }
  }

  if (!options.skipInstall) {
    await packageManager.installDependencies();
  }

  const installResult = await installStorybook(projectType as ProjectType, packageManager, options);

  if (!options.skipInstall) {
    await packageManager.installDependencies();
  }

  if (!options.disableTelemetry) {
    await telemetry('init', { projectType });
  }

  if (projectType === ProjectType.REACT_NATIVE) {
    logger.log(dedent`
      ${picocolors.yellow('NOTE: installation is not 100% automated.')}

      To run Storybook, you will need to:

      1. Replace the contents of your app entry with the following
      
      ${picocolors.inverse(' ' + "export {default} from './.storybook';" + ' ')}
      
      2. Enable transformer.unstable_allowRequireContext in your metro config
      
      For a more detailed guide go to:
      ${picocolors.cyan('https://github.com/storybookjs/react-native#existing-project')}
      
      Then to run your Storybook, type:

      ${picocolors.inverse(' ' + packageManager.getRunCommand('start') + ' ')}

    `);

    return { shouldRunDev: false };
  }

  const foundGitIgnoreFile = await findUp('.gitignore');
  const rootDirectory = getProjectRoot();
  if (foundGitIgnoreFile && foundGitIgnoreFile.includes(rootDirectory)) {
    const contents = await readFile(foundGitIgnoreFile, 'utf-8');
    if (!contents.includes('*storybook.log')) {
      await appendFile(foundGitIgnoreFile, '\n*storybook.log\n');
    }
  }

  const storybookCommand =
    projectType === ProjectType.ANGULAR
      ? `ng run ${installResult.projectName}:storybook`
      : packageManager.getRunStorybookCommand();

  logger.log(
    boxen(
      dedent`
          Storybook was successfully installed in your project! 🎉
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

      if (supportsOnboarding) {
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
