import { existsSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import { writeFile } from 'node:fs/promises';

import { babelParse, generate, traverse } from 'storybook/internal/babel';
import {
  JsPackageManagerFactory,
  extractProperFrameworkName,
  formatFileContent,
  loadAllPresets,
  loadMainConfig,
  serverResolve,
  validateFrameworkName,
  versions,
} from 'storybook/internal/common';
import { readConfig, writeConfig } from 'storybook/internal/csf-tools';
import { colors, logger } from 'storybook/internal/node-logger';

// eslint-disable-next-line depend/ban-dependencies
import { $ } from 'execa';
import { findUp } from 'find-up';
import { dirname, extname, join, relative, resolve } from 'pathe';
import picocolors from 'picocolors';
import prompts from 'prompts';
import { coerce, satisfies } from 'semver';
import { dedent } from 'ts-dedent';

import { type PostinstallOptions } from '../../../lib/cli-storybook/src/add';
import { SUPPORTED_FRAMEWORKS, SUPPORTED_RENDERERS } from './constants';
import { printError, printInfo, printSuccess, printWarning, step } from './postinstall-logger';
import { loadTemplate, updateConfigFile, updateWorkspaceFile } from './updateVitestFile';
import { getAddonNames } from './utils';

const ADDON_NAME = '@storybook/experimental-addon-test' as const;
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.cts', '.mts', '.cjs', '.mjs'];

const addonInteractionsName = '@storybook/addon-interactions';
const addonA11yName = '@storybook/addon-a11y';

const findFile = async (basename: string, extensions = EXTENSIONS) =>
  findUp(extensions.map((ext) => basename + ext));

export default async function postInstall(options: PostinstallOptions) {
  printSuccess(
    '👋 Howdy!',
    dedent`
      I'm the installation helper for ${colors.pink(ADDON_NAME)}

      Hold on for a moment while I look at your project and get it set up...
    `
  );

  const packageManager = JsPackageManagerFactory.getPackageManager({
    force: options.packageManager,
  });

  const info = await getStorybookInfo(options);
  const allDeps = await packageManager.getAllDependencies();
  // only install these dependencies if they are not already installed
  const dependencies = ['vitest', '@vitest/browser', 'playwright'].filter((p) => !allDeps[p]);
  const vitestVersionSpecifier = await packageManager.getInstalledVersion('vitest');
  const coercedVitestVersion = vitestVersionSpecifier ? coerce(vitestVersionSpecifier) : null;
  // if Vitest is installed, we use the same version to keep consistency across Vitest packages
  const vitestVersionToInstall = vitestVersionSpecifier ?? 'latest';

  const mainJsPath = serverResolve(resolve(options.configDir, 'main')) as string;
  const config = await readConfig(mainJsPath);

  const hasCustomWebpackConfig = !!config.getFieldNode(['webpackFinal']);

  const isInteractive = process.stdout.isTTY && !process.env.CI;

  if (info.frameworkPackageName === '@storybook/nextjs' && !hasCustomWebpackConfig) {
    const out =
      options.yes || !isInteractive
        ? { migrateToExperimentalNextjsVite: !!options.yes }
        : await prompts({
            type: 'confirm',
            name: 'migrateToExperimentalNextjsVite',
            message: dedent`
            The addon requires the use of @storybook/experimental-nextjs-vite to work with Next.js.
            https://storybook.js.org/docs/writing-tests/test-addon#install-and-set-up

            Do you want to migrate?
          `,
            initial: true,
          });

    if (out.migrateToExperimentalNextjsVite) {
      await packageManager.addDependencies({ installAsDevDependencies: true }, [
        `@storybook/experimental-nextjs-vite@${versions['@storybook/experimental-nextjs-vite']}`,
      ]);

      await packageManager.removeDependencies({}, ['@storybook/nextjs']);

      // eslint-disable-next-line no-underscore-dangle
      traverse(config._ast, {
        StringLiteral(path) {
          if (path.node.value === '@storybook/nextjs') {
            path.node.value = '@storybook/experimental-nextjs-vite';
          }
        },
      });

      await writeConfig(config, mainJsPath);

      info.frameworkPackageName = '@storybook/experimental-nextjs-vite';
      info.builderPackageName = '@storybook/builder-vite';
    }
  }

  const annotationsImport = SUPPORTED_FRAMEWORKS.includes(info.frameworkPackageName)
    ? info.frameworkPackageName === '@storybook/nextjs'
      ? '@storybook/experimental-nextjs-vite'
      : info.frameworkPackageName
    : info.rendererPackageName && SUPPORTED_RENDERERS.includes(info.rendererPackageName)
      ? info.rendererPackageName
      : null;

  const isRendererSupported = !!annotationsImport;

  const prerequisiteCheck = async () => {
    const reasons = [];

    if (hasCustomWebpackConfig) {
      reasons.push('• The addon can not be used with a custom Webpack configuration.');
    }

    if (
      info.frameworkPackageName !== '@storybook/nextjs' &&
      info.builderPackageName !== '@storybook/builder-vite'
    ) {
      reasons.push(
        '• The addon can only be used with a Vite-based Storybook framework or Next.js.'
      );
    }

    if (!isRendererSupported) {
      reasons.push(dedent`
        • The addon cannot yet be used with ${picocolors.bold(colors.pink(info.frameworkPackageName))}
      `);
    }

    if (coercedVitestVersion && !satisfies(coercedVitestVersion, '>=2.1.0')) {
      reasons.push(dedent`
        • The addon requires Vitest 2.1.0 or later. You are currently using ${picocolors.bold(vitestVersionSpecifier)}.
          Please update all of your Vitest dependencies and try again.
      `);
    }

    const mswVersionSpecifier = await packageManager.getInstalledVersion('msw');
    const coercedMswVersion = mswVersionSpecifier ? coerce(mswVersionSpecifier) : null;

    if (coercedMswVersion && !satisfies(coercedMswVersion, '>=2.0.0')) {
      reasons.push(dedent`
        • The addon uses Vitest behind the scenes, which supports only version 2 and above of MSW. However, we have detected version ${picocolors.bold(coercedMswVersion.version)} in this project.
        Please update the 'msw' package and try again.
      `);
    }

    if (info.frameworkPackageName === '@storybook/nextjs') {
      const nextVersion = await packageManager.getInstalledVersion('next');
      if (!nextVersion) {
        reasons.push(dedent`
          • You are using ${picocolors.bold(colors.pink('@storybook/nextjs'))} without having ${picocolors.bold(colors.pink('next'))} installed.
            Please install "next" or use a different Storybook framework integration and try again.
        `);
      }
    }

    if (reasons.length > 0) {
      reasons.unshift(
        `Storybook Test's automated setup failed due to the following package incompatibilities:`
      );
      reasons.push('--------------------------------');
      reasons.push(
        dedent`
          You can fix these issues and rerun the command to reinstall. If you wish to roll back the installation, remove ${picocolors.bold(colors.pink(ADDON_NAME))} from the "addons" array
          in your main Storybook config file and remove the dependency from your package.json file.
        `
      );

      if (!isRendererSupported) {
        reasons.push(
          dedent`
            Please check the documentation for more information about its requirements and installation:
            ${picocolors.cyan(`https://storybook.js.org/docs/writing-tests/test-addon`)}
          `
        );
      } else {
        reasons.push(
          dedent`
            Fear not, however, you can follow the manual installation process instead at:
            ${picocolors.cyan(`https://storybook.js.org/docs/writing-tests/test-addon#manual-setup`)}
          `
        );
      }

      return reasons.map((r) => r.trim()).join('\n\n');
    }

    return null;
  };

  const result = await prerequisiteCheck();

  if (result) {
    printError('⛔️ Sorry!', result);
    logger.line(1);
    return;
  }

  if (info.hasAddonInteractions) {
    let shouldUninstall = options.yes;
    if (!options.yes) {
      printInfo(
        '⚠️ Attention',
        dedent`
          We have detected that you're using ${addonInteractionsName}.
          The Storybook test addon is a replacement for the interactions addon, so you must uninstall and unregister it in order to use the test addon correctly. This can be done automatically.

          More info: ${picocolors.cyan('https://storybook.js.org/docs/writing-tests/test-addon')}
        `
      );

      const response = isInteractive
        ? await prompts({
            type: 'confirm',
            name: 'shouldUninstall',
            message: `Would you like me to remove and unregister ${addonInteractionsName}? Press N to abort the entire installation.`,
            initial: true,
          })
        : { shouldUninstall: true };

      shouldUninstall = response.shouldUninstall;
    }

    if (shouldUninstall) {
      await $({
        stdio: 'inherit',
      })`storybook remove ${addonInteractionsName} --package-manager ${options.packageManager} --config-dir ${options.configDir}`;
    }
  }

  if (info.frameworkPackageName === '@storybook/nextjs') {
    printInfo(
      '🍿 Just so you know...',
      dedent`
        It looks like you're using Next.js.

        Adding ${picocolors.bold(colors.pink(`@storybook/experimental-nextjs-vite/vite-plugin`))} so you can use it with Vitest.

        More info about the plugin at ${picocolors.cyan(`https://github.com/storybookjs/vite-plugin-storybook-nextjs`)}
      `
    );
    try {
      const storybookVersion = await packageManager.getInstalledVersion('storybook');
      dependencies.push(`@storybook/experimental-nextjs-vite@^${storybookVersion}`);
    } catch (e) {
      console.error(
        'Failed to install @storybook/experimental-nextjs-vite. Please install it manually'
      );
    }
  }

  const v8Version = await packageManager.getInstalledVersion('@vitest/coverage-v8');
  const istanbulVersion = await packageManager.getInstalledVersion('@vitest/coverage-istanbul');
  if (!v8Version && !istanbulVersion) {
    printInfo(
      '🙈 Let me cover this for you',
      dedent`
        You don't seem to have a coverage reporter installed. Vitest needs either V8 or Istanbul to generate coverage reports.

        Adding ${picocolors.bold(colors.pink(`@vitest/coverage-v8`))} to enable coverage reporting.
        Read more about Vitest coverage providers at ${picocolors.cyan(`https://vitest.dev/guide/coverage.html#coverage-providers`)}
      `
    );
    dependencies.push(`@vitest/coverage-v8`); // Version specifier is added below
  }

  const versionedDependencies = dependencies.map((p) => {
    if (p.includes('vitest')) {
      return `${p}@${vitestVersionToInstall ?? 'latest'}`;
    }

    return p;
  });

  if (versionedDependencies.length > 0) {
    logger.line(1);
    logger.plain(`${step} Installing dependencies:`);
    logger.plain(colors.gray('  ' + versionedDependencies.join(', ')));

    await packageManager.addDependencies({ installAsDevDependencies: true }, versionedDependencies);
  }

  logger.line(1);
  logger.plain(`${step} Configuring Playwright with Chromium (this might take some time):`);
  logger.plain(colors.gray('  npx playwright install chromium --with-deps'));

  await packageManager.executeCommand({
    command: 'npx',
    args: ['playwright', 'install', 'chromium', '--with-deps'],
  });

  const fileExtension =
    allDeps.typescript || (await findFile('tsconfig', [...EXTENSIONS, '.json'])) ? 'ts' : 'js';

  const vitestSetupFile = resolve(options.configDir, `vitest.setup.${fileExtension}`);
  if (existsSync(vitestSetupFile)) {
    printError(
      '🚨 Oh no!',
      dedent`
        Found an existing Vitest setup file:
        ${colors.gray(vitestSetupFile)}

        Please refer to the documentation to complete the setup manually:
        ${picocolors.cyan(`https://storybook.js.org/docs/writing-tests/test-addon#manual-setup`)}
      `
    );
    logger.line(1);
    return;
  }

  logger.line(1);
  logger.plain(`${step} Creating a Vitest setup file for Storybook:`);
  logger.plain(colors.gray(`  ${vitestSetupFile}`));

  const previewExists = EXTENSIONS.map((ext) => resolve(options.configDir, `preview${ext}`)).some(
    existsSync
  );

  const imports = [
    `import { beforeAll } from 'vitest';`,
    `import { setProjectAnnotations } from '${annotationsImport}';`,
  ];

  const projectAnnotations = [];

  if (previewExists) {
    imports.push(`import * as projectAnnotations from './preview';`);
    projectAnnotations.push('projectAnnotations');
  }

  await writeFile(
    vitestSetupFile,
    dedent`
      ${imports.join('\n')}

      // This is an important step to apply the right configuration when testing your stories.
      // More info at: https://storybook.js.org/docs/api/portable-stories/portable-stories-vitest#setprojectannotations
      const project = setProjectAnnotations([${projectAnnotations.join(', ')}]);

      beforeAll(project.beforeAll);
    `
  );

  const a11yAddon = info.addons.find((addon) => addon.includes(addonA11yName));

  if (a11yAddon) {
    try {
      logger.plain(`${step} Setting up ${addonA11yName} for @storybook/experimental-addon-test:`);
      await $({
        stdio: 'inherit',
      })`storybook automigrate addonA11yAddonTest ${options.yes ? '--yes' : ''}`;
    } catch (e) {
      printError(
        '🚨 Oh no!',
        dedent`
        We have detected that you have ${addonA11yName} installed but could not automatically set it up for @storybook/experimental-addon-test.

        Please refer to the documentation to complete the setup manually:
        ${picocolors.cyan(`https://storybook.js.org/docs/writing-tests/accessibility-testing#test-addon-integration`)}
      `
      );
    }
  }

  const vitestWorkspaceFile = await findFile('vitest.workspace', ['.ts', '.js', '.json']);
  const viteConfigFile = await findFile('vite.config');
  const vitestConfigFile = await findFile('vitest.config');
  const vitestShimFile = await findFile('vitest.shims.d');
  const rootConfig = vitestConfigFile || viteConfigFile;

  const isVitest3OrLater = !!(coercedVitestVersion && satisfies(coercedVitestVersion, '>=3.0.0'));

  const browserConfig = isVitest3OrLater
    ? `{
        enabled: true,
        headless: true,
        provider: 'playwright',
        instances: [{ browser: 'chromium' }]
      }`
    : `{
        enabled: true,
        headless: true,
        name: 'chromium',
        provider: 'playwright'
      }`;

  if (isVitest3OrLater && fileExtension === 'ts' && !vitestShimFile) {
    await writeFile(
      'vitest.shims.d.ts',
      '/// <reference types="@vitest/browser/providers/playwright" />'
    );
  }

  // If there's an existing workspace file, we update that file to include the Storybook test plugin.
  // We assume the existing workspaces include the Vite(st) config, so we won't add it.
  if (vitestWorkspaceFile) {
    const workspaceTemplate = await loadTemplate('vitest.workspace.template.ts', {
      EXTENDS_WORKSPACE: viteConfigFile
        ? relative(dirname(vitestWorkspaceFile), viteConfigFile)
        : '',
      CONFIG_DIR: options.configDir,
      BROWSER_CONFIG: browserConfig,
      SETUP_FILE: relative(dirname(vitestWorkspaceFile), vitestSetupFile),
    }).then((t) => t.replace(`\n  'ROOT_CONFIG',`, '').replace(/\s+extends: '',/, ''));
    const workspaceFile = await fs.readFile(vitestWorkspaceFile, 'utf8');
    const source = babelParse(workspaceTemplate);
    const target = babelParse(workspaceFile);

    const updated = updateWorkspaceFile(source, target);
    if (updated) {
      logger.line(1);
      logger.plain(`${step} Updating your Vitest workspace file:`);
      logger.plain(colors.gray(`  ${vitestWorkspaceFile}`));

      const formattedContent = await formatFileContent(vitestWorkspaceFile, generate(target).code);
      await writeFile(vitestWorkspaceFile, formattedContent);
    } else {
      printError(
        '🚨 Oh no!',
        dedent`
          Could not update existing Vitest workspace file:
          ${colors.gray(vitestWorkspaceFile)}

          I was able to configure most of the addon but could not safely extend
          your existing workspace file automatically, you must do it yourself.

          Please refer to the documentation to complete the setup manually:
          ${picocolors.cyan(`https://storybook.js.org/docs/writing-tests/test-addon#manual-setup`)}
        `
      );
      logger.line(1);
      return;
    }
  }
  // If there's an existing Vite/Vitest config with workspaces, we update it to include the Storybook test plugin.
  else if (rootConfig) {
    let target, updated;
    const configFile = await fs.readFile(rootConfig, 'utf8');
    const hasWorkspaceConfig = configFile.includes('workspace:');

    // For Vitest 3+ with an existing workspace option in the config file, we extend the workspace array,
    // otherwise we fall back to creating a workspace file.
    if (isVitest3OrLater && hasWorkspaceConfig) {
      const configTemplate = await loadTemplate('vitest.config.template.ts', {
        CONFIG_DIR: options.configDir,
        BROWSER_CONFIG: browserConfig,
        SETUP_FILE: relative(dirname(rootConfig), vitestSetupFile),
      });
      const source = babelParse(configTemplate);
      target = babelParse(configFile);
      updated = updateConfigFile(source, target);
    }

    if (target && updated) {
      logger.line(1);
      logger.plain(`${step} Updating your ${vitestConfigFile ? 'Vitest' : 'Vite'} config file:`);
      logger.plain(colors.gray(`  ${rootConfig}`));

      const formattedContent = await formatFileContent(rootConfig, generate(target).code);
      await writeFile(rootConfig, formattedContent);
    } else {
      // Fall back to creating a workspace file if we can't update the config file.
      printWarning(
        '⚠️ Cannot update config file',
        dedent`
          Could not update your existing ${vitestConfigFile ? 'Vitest' : 'Vite'} config file:
          ${colors.gray(rootConfig)}

          Your existing config file cannot be safely updated, so instead a new Vitest
          workspace file will be created, extending from your config file.

          Please refer to the Vitest documentation to learn about the workspace file:
          ${picocolors.cyan(`https://vitest.dev/guide/workspace.html`)}
        `
      );

      const extension = extname(rootConfig).includes('ts') ? '.ts' : '.js';
      const newWorkspaceFile = resolve(dirname(rootConfig), `vitest.workspace${extension}`);
      const workspaceTemplate = await loadTemplate('vitest.workspace.template.ts', {
        ROOT_CONFIG: relative(dirname(newWorkspaceFile), rootConfig),
        EXTENDS_WORKSPACE: viteConfigFile
          ? relative(dirname(newWorkspaceFile), viteConfigFile)
          : '',
        CONFIG_DIR: options.configDir,
        BROWSER_CONFIG: browserConfig,
        SETUP_FILE: relative(dirname(newWorkspaceFile), vitestSetupFile),
      }).then((t) => t.replace(/\s+extends: '',/, ''));

      logger.line(1);
      logger.plain(`${step} Creating a Vitest workspace file:`);
      logger.plain(colors.gray(`  ${newWorkspaceFile}`));

      const formattedContent = await formatFileContent(newWorkspaceFile, workspaceTemplate);
      await writeFile(newWorkspaceFile, formattedContent);
    }
  }
  // If there's no existing Vitest/Vite config, we create a new Vitest config file.
  else {
    const newConfigFile = resolve(`vitest.config.${fileExtension}`);
    const configTemplate = await loadTemplate('vitest.config.template.ts', {
      CONFIG_DIR: options.configDir,
      BROWSER_CONFIG: browserConfig,
      SETUP_FILE: relative(dirname(newConfigFile), vitestSetupFile),
    });

    logger.line(1);
    logger.plain(`${step} Creating a Vitest config file:`);
    logger.plain(colors.gray(`  ${newConfigFile}`));

    const formattedContent = await formatFileContent(newConfigFile, configTemplate);
    await writeFile(newConfigFile, formattedContent);
  }

  const runCommand = rootConfig ? `npx vitest --project=storybook` : `npx vitest`;

  printSuccess(
    '🎉 All done!',
    dedent`
      The Storybook Test addon is now configured and you're ready to run your tests!

      Here are a couple of tips to get you started:
      • You can run tests with ${colors.gray(runCommand)}
      • When using the Vitest extension in your editor, all of your stories will be shown as tests!

      Check the documentation for more information about its features and options at:
      ${picocolors.cyan(`https://storybook.js.org/docs/writing-tests/test-addon`)}
    `
  );
  logger.line(1);
}

async function getStorybookInfo({ configDir, packageManager: pkgMgr }: PostinstallOptions) {
  const packageManager = JsPackageManagerFactory.getPackageManager({ force: pkgMgr });
  const packageJson = await packageManager.retrievePackageJson();

  const config = await loadMainConfig({ configDir, noCache: true });
  const { framework } = config;

  const frameworkName = typeof framework === 'string' ? framework : framework?.name;
  validateFrameworkName(frameworkName);
  const frameworkPackageName = extractProperFrameworkName(frameworkName);

  const presets = await loadAllPresets({
    corePresets: [join(frameworkName, 'preset')],
    overridePresets: [
      require.resolve('storybook/internal/core-server/presets/common-override-preset'),
    ],
    configDir,
    packageJson,
    isCritical: true,
  });

  const hasAddonInteractions = !!(await presets.apply('ADDON_INTERACTIONS_IN_USE', false));

  const core = await presets.apply('core', {});

  const { builder, renderer } = core;

  if (!builder) {
    throw new Error('Could not detect your Storybook builder.');
  }

  const builderPackageJson = await fs.readFile(
    require.resolve(join(typeof builder === 'string' ? builder : builder.name, 'package.json')),
    'utf8'
  );
  const builderPackageName = JSON.parse(builderPackageJson).name;

  let rendererPackageName: string | undefined;
  if (renderer) {
    const rendererPackageJson = await fs.readFile(
      require.resolve(join(renderer, 'package.json')),
      'utf8'
    );
    rendererPackageName = JSON.parse(rendererPackageJson).name;
  }

  return {
    frameworkPackageName,
    builderPackageName,
    rendererPackageName,
    hasAddonInteractions,
    addons: getAddonNames(config),
  };
}
