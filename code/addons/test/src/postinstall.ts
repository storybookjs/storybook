import { existsSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import { writeFile } from 'node:fs/promises';

import { traverse } from 'storybook/internal/babel';
import {
  JsPackageManagerFactory,
  extractProperFrameworkName,
  loadAllPresets,
  loadMainConfig,
  serverResolve,
  validateFrameworkName,
  versions,
} from 'storybook/internal/common';
import { readConfig, writeConfig } from 'storybook/internal/csf-tools';
import { colors, logger } from 'storybook/internal/node-logger';

// eslint-disable-next-line depend/ban-dependencies
import { execa } from 'execa';
import { findUp } from 'find-up';
import { dirname, extname, join, relative, resolve } from 'pathe';
import picocolors from 'picocolors';
import prompts from 'prompts';
import { coerce, satisfies } from 'semver';
import { dedent } from 'ts-dedent';

import { type PostinstallOptions } from '../../../lib/cli-storybook/src/add';
import { printError, printInfo, printSuccess, step } from './postinstall-logger';
import { getAddonNames } from './utils';

const ADDON_NAME = '@storybook/experimental-addon-test' as const;
const EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.cts', '.mts', '.cjs', '.mjs'] as const;

const addonInteractionsName = '@storybook/addon-interactions';
const addonA11yName = '@storybook/addon-a11y';

const findFile = async (basename: string, extraExtensions: string[] = []) =>
  findUp([...EXTENSIONS, ...extraExtensions].map((ext) => basename + ext));

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
  const vitestVersionSpecifier =
    allDeps.vitest || (await packageManager.getInstalledVersion('vitest'));
  const coercedVitestVersion = vitestVersionSpecifier ? coerce(vitestVersionSpecifier) : null;
  // if Vitest is installed, we use the same version to keep consistency across Vitest packages
  const vitestVersionToInstall = vitestVersionSpecifier ?? 'latest';

  const mainJsPath = serverResolve(resolve(options.configDir, 'main')) as string;
  const config = await readConfig(mainJsPath);

  const hasCustomWebpackConfig = !!config.getFieldNode(['webpackFinal']);

  if (info.frameworkPackageName === '@storybook/nextjs' && !hasCustomWebpackConfig) {
    const out = options.yes
      ? {
          migrateToExperimentalNextjsVite: true,
        }
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

  const annotationsImport = [
    '@storybook/nextjs',
    '@storybook/experimental-nextjs-vite',
    '@storybook/sveltekit',
  ].includes(info.frameworkPackageName)
    ? info.frameworkPackageName === '@storybook/nextjs'
      ? '@storybook/experimental-nextjs-vite'
      : info.frameworkPackageName
    : info.rendererPackageName &&
        ['@storybook/react', '@storybook/svelte', '@storybook/vue3'].includes(
          info.rendererPackageName
        )
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
            ${picocolors.cyan(`https://storybook.js.org/docs/writing-tests/vitest-plugin`)}
          `
        );
      } else {
        reasons.push(
          dedent`
            Fear not, however, you can follow the manual installation process instead at:
            ${picocolors.cyan(`https://storybook.js.org/docs/writing-tests/vitest-plugin#manual`)}
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

      const response = await prompts({
        type: 'confirm',
        name: 'shouldUninstall',
        message: `Would you like me to remove and unregister ${addonInteractionsName}? Press N to abort the entire installation.`,
        initial: true,
      });

      shouldUninstall = response.shouldUninstall;
    }

    if (shouldUninstall) {
      await execa(
        packageManager.getRemoteRunCommand(),
        [
          'storybook',
          'remove',
          addonInteractionsName,
          '--package-manager',
          options.packageManager,
          '--config-dir',
          options.configDir,
        ],
        {
          shell: true,
          stdio: 'inherit',
        }
      );
    }
  }

  const vitestInfo = getVitestPluginInfo(info.frameworkPackageName);

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
    allDeps['typescript'] || (await findFile('tsconfig', ['.json'])) ? 'ts' : 'js';

  const vitestSetupFile = resolve(options.configDir, `vitest.setup.${fileExtension}`);
  if (existsSync(vitestSetupFile)) {
    printError(
      '🚨 Oh no!',
      dedent`
        Found an existing Vitest setup file:
        ${colors.gray(vitestSetupFile)}

        Please refer to the documentation to complete the setup manually:
        ${picocolors.cyan(`https://storybook.js.org/docs/writing-tests/vitest-plugin#manual`)}
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

  const a11yAddon = info.addons.find((addon) => addon.includes(addonA11yName));

  const imports = [
    `import { beforeAll } from 'vitest';`,
    `import { setProjectAnnotations } from '${annotationsImport}';`,
  ];

  const projectAnnotations = [];

  if (a11yAddon) {
    imports.push(`import * as a11yAddonAnnotations from '@storybook/addon-a11y/preview';`);
    projectAnnotations.push('a11yAddonAnnotations');
  }

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

  // Check for existing Vitest workspace. We can't extend it so manual setup is required.
  const vitestWorkspaceFile = await findFile('vitest.workspace');
  if (vitestWorkspaceFile) {
    printError(
      '🚨 Oh no!',
      dedent`
        Found an existing Vitest workspace file:
        ${colors.gray(vitestWorkspaceFile)}

        I was able to configure most of the addon but could not safely extend
        your existing workspace file automatically, you must do it yourself. This was the last step.

        Please refer to the documentation to complete the setup manually:
        ${picocolors.cyan(`https://storybook.js.org/docs/writing-tests/vitest-plugin#manual`)}
      `
    );
    logger.line(1);
    return;
  }

  // Check for an existing config file. Can be from Vitest (preferred) or Vite (with `test` option).
  const viteConfigFile = await findFile('vite.config');
  if (viteConfigFile) {
    const viteConfig = await fs.readFile(viteConfigFile, 'utf8');
    if (viteConfig.match(/\Wtest:\s*{/)) {
      printError(
        '🚨 Oh no!',
        dedent`
          You seem to have an existing test configuration in your Vite config file:
          ${colors.gray(vitestWorkspaceFile || '')}

          I was able to configure most of the addon but could not safely extend
          your existing workspace file automatically, you must do it yourself. This was the last step.

          Please refer to the documentation to complete the setup manually:
          ${picocolors.cyan(`https://storybook.js.org/docs/writing-tests/vitest-plugin#manual`)}
        `
      );
      logger.line(1);
      return;
    }
  }

  const vitestConfigFile = await findFile('vitest.config');
  const rootConfig = vitestConfigFile || viteConfigFile;

  if (rootConfig) {
    // If there's an existing config, we create a workspace file so we can run Storybook tests alongside.
    const extension = extname(rootConfig);
    const browserWorkspaceFile = resolve(dirname(rootConfig), `vitest.workspace${extension}`);

    logger.line(1);
    logger.plain(`${step} Creating a Vitest project workspace file:`);
    logger.plain(colors.gray(`  ${browserWorkspaceFile}`));

    await writeFile(
      browserWorkspaceFile,
      dedent`
        import { defineWorkspace } from 'vitest/config';
        import { storybookTest } from '@storybook/experimental-addon-test/vitest-plugin';${vitestInfo.frameworkPluginImport}

        // More info at: https://storybook.js.org/docs/writing-tests/vitest-plugin
        export default defineWorkspace([
          '${relative(dirname(browserWorkspaceFile), rootConfig)}',
          {
            extends: '${viteConfigFile ? relative(dirname(browserWorkspaceFile), viteConfigFile) : ''}',
            plugins: [
              // The plugin will run tests for the stories defined in your Storybook config
              // See options at: https://storybook.js.org/docs/writing-tests/vitest-plugin#storybooktest
              storybookTest({ configDir: '${options.configDir}' }),${vitestInfo.frameworkPluginDocs + vitestInfo.frameworkPluginCall}
            ],
            test: {
              name: 'storybook',
              browser: {
                enabled: true,
                headless: true,
                name: 'chromium',
                provider: 'playwright',
              },
              setupFiles: ['./.storybook/vitest.setup.ts'],
            },
          },
        ]);
      `.replace(/\s+extends: '',/, '')
    );
  } else {
    // If there's no existing Vitest/Vite config, we create a new Vitest config file.
    const newVitestConfigFile = resolve(`vitest.config.${fileExtension}`);
    // to be set in vitest config
    const vitestSetupFilePath = relative(dirname(newVitestConfigFile), vitestSetupFile);

    logger.line(1);
    logger.plain(`${step} Creating a Vitest project config file:`);
    logger.plain(colors.gray(`  ${newVitestConfigFile}`));

    await writeFile(
      newVitestConfigFile,
      dedent`
        import { defineConfig } from 'vitest/config';
        import { storybookTest } from '@storybook/experimental-addon-test/vitest-plugin';${vitestInfo.frameworkPluginImport}

        // More info at: https://storybook.js.org/docs/writing-tests/vitest-plugin
        export default defineConfig({
          plugins: [
            // The plugin will run tests for the stories defined in your Storybook config
            // See options at: https://storybook.js.org/docs/writing-tests/vitest-plugin#storybooktest
            storybookTest({ configDir: '${options.configDir}' }),${vitestInfo.frameworkPluginDocs + vitestInfo.frameworkPluginCall}
          ],
          test: {
            name: 'storybook',
            browser: {
              enabled: true,
              headless: true,
              name: 'chromium',
              provider: 'playwright',
            },
            setupFiles: ['${vitestSetupFilePath}'],
          },
        });
      `
    );
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
      ${picocolors.cyan(`https://storybook.js.org/docs/writing-tests/vitest-plugin`)}
    `
  );
  logger.line(1);
}

const getVitestPluginInfo = (framework: string) => {
  let frameworkPluginImport = '';
  let frameworkPluginCall = '';
  let frameworkPluginDocs = '';

  if (framework === '@storybook/nextjs' || framework === '@storybook/experimental-nextjs-vite') {
    frameworkPluginImport =
      "import { storybookNextJsPlugin } from '@storybook/experimental-nextjs-vite/vite-plugin';";
    frameworkPluginDocs =
      '// More info at: https://github.com/storybookjs/vite-plugin-storybook-nextjs';
    frameworkPluginCall = 'storybookNextJsPlugin()';
  }

  if (framework === '@storybook/sveltekit') {
    frameworkPluginImport =
      "import { storybookSveltekitPlugin } from '@storybook/sveltekit/vite-plugin';";
    frameworkPluginCall = 'storybookSveltekitPlugin()';
  }

  if (framework === '@storybook/vue3-vite') {
    frameworkPluginImport =
      "import { storybookVuePlugin } from '@storybook/vue3-vite/vite-plugin';";
    frameworkPluginCall = 'storybookVuePlugin()';
  }

  if (framework === '@storybook/react-native-web-vite') {
    frameworkPluginImport =
      "import { storybookReactNativeWeb } from '@storybook/react-native-web-vite/vite-plugin';";
    frameworkPluginCall = 'storybookReactNativeWeb()';
  }

  // spaces for file indentation
  frameworkPluginImport = `\n${frameworkPluginImport}`;
  frameworkPluginDocs = frameworkPluginDocs ? `\n    ${frameworkPluginDocs}` : '';
  frameworkPluginCall = frameworkPluginCall ? `\n    ${frameworkPluginCall},` : '';

  return { frameworkPluginImport, frameworkPluginCall, frameworkPluginDocs };
};

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
      require.resolve('@storybook/core/core-server/presets/common-override-preset'),
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
