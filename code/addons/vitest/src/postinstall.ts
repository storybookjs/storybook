import { existsSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import { writeFile } from 'node:fs/promises';
import { isAbsolute, posix, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { babelParse, generate, traverse } from 'storybook/internal/babel';
import {
  JsPackageManagerFactory,
  formatFileContent,
  getInterpretedFile,
  getProjectRoot,
  isCI,
  loadMainConfig,
  scanAndTransformFiles,
  transformImportFiles,
} from 'storybook/internal/common';
import { experimental_loadStorybook } from 'storybook/internal/core-server';
import { readConfig, writeConfig } from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';

import * as find from 'empathic/find';
import * as pkg from 'empathic/package';
// eslint-disable-next-line depend/ban-dependencies
import { execa } from 'execa';
import { dirname, relative, resolve } from 'pathe';
import prompts from 'prompts';
import { coerce, satisfies } from 'semver';
import { dedent } from 'ts-dedent';

import { type PostinstallOptions } from '../../../lib/cli-storybook/src/add';
import { DOCUMENTATION_LINK, SUPPORTED_FRAMEWORKS } from './constants';
import { printError, printInfo, printSuccess, printWarning, step } from './postinstall-logger';
import { loadTemplate, updateConfigFile, updateWorkspaceFile } from './updateVitestFile';
import { getAddonNames } from './utils';

const ADDON_NAME = '@storybook/addon-vitest' as const;
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.cts', '.mts', '.cjs', '.mjs'];

const addonA11yName = '@storybook/addon-a11y';

let hasErrors = false;

function nameMatches(name: string, pattern: string) {
  if (name === pattern) {
    return true;
  }

  if (name.includes(`${pattern}${sep}`)) {
    return true;
  }
  if (name.includes(`${pattern}${posix.sep}`)) {
    return true;
  }

  return false;
}

const logErrors = (...args: Parameters<typeof printError>) => {
  hasErrors = true;
  printError(...args);
};

const findFile = (basename: string, extensions = EXTENSIONS) =>
  find.any(
    extensions.map((ext) => basename + ext),
    { last: getProjectRoot() }
  );

export default async function postInstall(options: PostinstallOptions) {
  printSuccess(
    '👋 Howdy!',
    dedent`
      I'm the installation helper for ${ADDON_NAME}

      Hold on for a moment while I look at your project and get it set up...
    `
  );

  const packageManager = JsPackageManagerFactory.getPackageManager({
    force: options.packageManager,
  });

  const vitestVersionSpecifier = await packageManager.getInstalledVersion('vitest');
  const coercedVitestVersion = vitestVersionSpecifier ? coerce(vitestVersionSpecifier) : null;
  const isVitest3_2To4 = vitestVersionSpecifier
    ? satisfies(vitestVersionSpecifier, '>=3.2.0 <4.0.0')
    : false;
  const isVitest4OrNewer = vitestVersionSpecifier
    ? satisfies(vitestVersionSpecifier, '>=4.0.0')
    : true;

  const info = await getStorybookInfo(options);
  const allDeps = packageManager.getAllDependencies();
  // only install these dependencies if they are not already installed
  const dependencies = [
    'vitest',
    'playwright',
    isVitest4OrNewer ? '@vitest/browser-playwright' : '@vitest/browser',
  ];

  const uniqueDependencies = dependencies.filter((p) => !allDeps[p]);

  const mainJsPath = getInterpretedFile(resolve(options.configDir, 'main')) as string;
  const config = await readConfig(mainJsPath);

  const hasCustomWebpackConfig = !!config.getFieldNode(['webpackFinal']);

  const isInteractive = process.stdout.isTTY && !isCI();

  if (nameMatches(info.frameworkPackageName, '@storybook/nextjs') && !hasCustomWebpackConfig) {
    const out =
      options.yes || !isInteractive
        ? { migrateToNextjsVite: !!options.yes }
        : await prompts({
            type: 'confirm',
            name: 'migrateToNextjsVite',
            message: dedent`
            The addon requires the use of @storybook/nextjs-vite to work with Next.js.
            https://storybook.js.org/docs/next/${DOCUMENTATION_LINK}#install-and-set-up

            Do you want to migrate?
          `,
            initial: true,
          });

    if (out.migrateToNextjsVite) {
      await packageManager.addDependencies({ type: 'devDependencies', skipInstall: true }, [
        '@storybook/nextjs-vite',
      ]);

      await packageManager.removeDependencies(['@storybook/nextjs']);

      traverse(config._ast, {
        StringLiteral(path) {
          if (path.node.value === '@storybook/nextjs') {
            path.node.value = '@storybook/nextjs-vite';
          }
        },
      });

      await writeConfig(config, mainJsPath);

      info.frameworkPackageName = '@storybook/nextjs-vite';
      info.builderPackageName = '@storybook/builder-vite';

      await scanAndTransformFiles({
        promptMessage:
          'Enter a glob to scan for all @storybook/nextjs imports to substitute with @storybook/nextjs-vite:',
        force: options.yes,
        dryRun: false,
        transformFn: (files, options, dryRun) => transformImportFiles(files, options, dryRun),
        transformOptions: {
          '@storybook/nextjs': '@storybook/nextjs-vite',
        },
      });
    }
  }

  const annotationsImport = SUPPORTED_FRAMEWORKS.find((f) =>
    nameMatches(info.frameworkPackageName, f)
  )
    ? info.frameworkPackageName === '@storybook/nextjs'
      ? '@storybook/nextjs-vite'
      : info.frameworkPackageName
    : null;

  const isRendererSupported = !!annotationsImport;

  const prerequisiteCheck = async () => {
    const reasons = [];

    if (hasCustomWebpackConfig) {
      reasons.push('• The addon can not be used with a custom Webpack configuration.');
    }

    if (
      !nameMatches(info.frameworkPackageName, '@storybook/nextjs') &&
      !nameMatches(info.builderPackageName, '@storybook/builder-vite')
    ) {
      reasons.push(
        '• The addon can only be used with a Vite-based Storybook framework or Next.js.'
      );
    }

    if (!isRendererSupported) {
      reasons.push(dedent`
        • The addon cannot yet be used with ${info.frameworkPackageName}
      `);
    }

    if (coercedVitestVersion && !satisfies(coercedVitestVersion, '>=3.0.0')) {
      reasons.push(dedent`
        • The addon requires Vitest 3.0.0 or higher. You are currently using ${vitestVersionSpecifier}.
          Please update all of your Vitest dependencies and try again.
      `);
    }

    const mswVersionSpecifier = await packageManager.getInstalledVersion('msw');
    const coercedMswVersion = mswVersionSpecifier ? coerce(mswVersionSpecifier) : null;

    if (coercedMswVersion && !satisfies(coercedMswVersion, '>=2.0.0')) {
      reasons.push(dedent`
        • The addon uses Vitest behind the scenes, which supports only version 2 and above of MSW. However, we have detected version ${coercedMswVersion.version} in this project.
        Please update the 'msw' package and try again.
      `);
    }

    if (nameMatches(info.frameworkPackageName, '@storybook/nextjs')) {
      const nextVersion = await packageManager.getInstalledVersion('next');
      if (!nextVersion) {
        reasons.push(dedent`
          • You are using @storybook/nextjs without having "next" installed.
            Please install "next" or use a different Storybook framework integration and try again.
        `);
      }
    }

    if (reasons.length > 0) {
      reasons.unshift(
        `@storybook/addon-vitest's automated setup failed due to the following package incompatibilities:`
      );
      reasons.push('--------------------------------');
      reasons.push(
        dedent`
          You can fix these issues and rerun the command to reinstall. If you wish to roll back the installation, remove ${ADDON_NAME} from the "addons" array
          in your main Storybook config file and remove the dependency from your package.json file.
        `
      );

      if (!isRendererSupported) {
        reasons.push(
          dedent`
            Please check the documentation for more information about its requirements and installation:
            https://storybook.js.org/docs/next/${DOCUMENTATION_LINK}
          `
        );
      } else {
        reasons.push(
          dedent`
            Fear not, however, you can follow the manual installation process instead at:
            https://storybook.js.org/docs/next/${DOCUMENTATION_LINK}#manual-setup
          `
        );
      }

      return reasons.map((r) => r.trim()).join('\n\n');
    }

    return null;
  };

  const result = await prerequisiteCheck();

  if (result) {
    logErrors('⛔️ Sorry!', result);
    logger.line(1);
    return;
  }

  if (info.frameworkPackageName === '@storybook/nextjs') {
    printInfo(
      '🍿 Just so you know...',
      dedent`
        It looks like you're using Next.js.

        Adding "@storybook/nextjs-vite/vite-plugin" so you can use it with Vitest.

        More info about the plugin at https://github.com/storybookjs/vite-plugin-storybook-nextjs
      `
    );
    try {
      const storybookVersion = await packageManager.getInstalledVersion('storybook');
      uniqueDependencies.push(`@storybook/nextjs-vite@^${storybookVersion}`);
    } catch (e) {
      console.error('Failed to install @storybook/nextjs-vite. Please install it manually');
    }
  }

  const v8Version = await packageManager.getInstalledVersion('@vitest/coverage-v8');
  const istanbulVersion = await packageManager.getInstalledVersion('@vitest/coverage-istanbul');
  if (!v8Version && !istanbulVersion) {
    printInfo(
      '🙈 Let me cover this for you',
      dedent`
        You don't seem to have a coverage reporter installed. Vitest needs either V8 or Istanbul to generate coverage reports.

        Adding "@vitest/coverage-v8" to enable coverage reporting.
        Read more about Vitest coverage providers at https://vitest.dev/guide/coverage.html#coverage-providers
      `
    );
    uniqueDependencies.push(`@vitest/coverage-v8`); // Version specifier is added below
  }

  const versionedDependencies = uniqueDependencies.map((p) => {
    if (p.includes('vitest')) {
      return vitestVersionSpecifier ? `${p}@${vitestVersionSpecifier.split('::')[0]}` : p;
    }

    return p;
  });

  if (versionedDependencies.length > 0) {
    await packageManager.addDependencies(
      { type: 'devDependencies', skipInstall: true },
      versionedDependencies
    );
    logger.line(1);
    logger.plain(`${step} Installing dependencies:`);
    logger.plain('  ' + versionedDependencies.join(', '));
  }

  await packageManager.installDependencies();

  logger.line(1);

  if (options.skipInstall) {
    logger.plain('Skipping Playwright installation, please run this command manually:');
    logger.plain('  npx playwright install chromium --with-deps');
  } else {
    logger.plain(`${step} Configuring Playwright with Chromium (this might take some time):`);
    logger.plain('  npx playwright install chromium --with-deps');
    try {
      await packageManager.executeCommand({
        command: 'npx',
        args: ['playwright', 'install', 'chromium', '--with-deps'],
      });
    } catch (e) {
      console.error('Failed to install Playwright. Please install it manually');
    }
  }

  const fileExtension =
    allDeps.typescript || findFile('tsconfig', [...EXTENSIONS, '.json']) ? 'ts' : 'js';

  const vitestSetupFile = resolve(options.configDir, `vitest.setup.${fileExtension}`);
  if (existsSync(vitestSetupFile)) {
    logErrors(
      '🚨 Oh no!',
      dedent`
        Found an existing Vitest setup file:
        ${vitestSetupFile}

        Please refer to the documentation to complete the setup manually:
        https://storybook.js.org/docs/next/${DOCUMENTATION_LINK}#manual-setup
      `
    );
    logger.line(1);
    return;
  }

  logger.line(1);
  logger.plain(`${step} Creating a Vitest setup file for Storybook:`);
  logger.plain(`  ${vitestSetupFile}`);

  const previewExists = EXTENSIONS.map((ext) => resolve(options.configDir, `preview${ext}`)).some(
    existsSync
  );

  const imports = [`import { setProjectAnnotations } from '${annotationsImport}';`];

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
      setProjectAnnotations([${projectAnnotations.join(', ')}]);
    `
  );

  const vitestWorkspaceFile = findFile('vitest.workspace', ['.ts', '.js', '.json']);
  const viteConfigFile = findFile('vite.config');
  const vitestConfigFile = findFile('vitest.config');
  const vitestShimFile = findFile('vitest.shims.d');
  const rootConfig = vitestConfigFile || viteConfigFile;

  if (fileExtension === 'ts' && !vitestShimFile) {
    await writeFile(
      'vitest.shims.d.ts',
      isVitest4OrNewer
        ? '/// <reference types="@vitest/browser-playwright" />'
        : '/// <reference types="@vitest/browser/providers/playwright" />'
    );
  }

  const getTemplateName = () => {
    if (isVitest4OrNewer) {
      return 'vitest.config.4.template.ts';
    } else if (isVitest3_2To4) {
      return 'vitest.config.3.2.template.ts';
    }
    return 'vitest.config.template.ts';
  };

  // If there's an existing workspace file, we update that file to include the Storybook Addon Vitest plugin.
  // We assume the existing workspaces include the Vite(st) config, so we won't add it.
  if (vitestWorkspaceFile) {
    const workspaceTemplate = await loadTemplate('vitest.workspace.template.ts', {
      EXTENDS_WORKSPACE: viteConfigFile
        ? relative(dirname(vitestWorkspaceFile), viteConfigFile)
        : '',
      CONFIG_DIR: options.configDir,
      SETUP_FILE: relative(dirname(vitestWorkspaceFile), vitestSetupFile),
    }).then((t) => t.replace(`\n  'ROOT_CONFIG',`, '').replace(/\s+extends: '',/, ''));
    const workspaceFile = await fs.readFile(vitestWorkspaceFile, 'utf8');
    const source = babelParse(workspaceTemplate);
    const target = babelParse(workspaceFile);

    const updated = updateWorkspaceFile(source, target);
    if (updated) {
      logger.line(1);
      logger.plain(`${step} Updating your Vitest workspace file:`);
      logger.plain(`  ${vitestWorkspaceFile}`);

      const formattedContent = await formatFileContent(vitestWorkspaceFile, generate(target).code);
      await writeFile(vitestWorkspaceFile, formattedContent);
    } else {
      logErrors(
        '🚨 Oh no!',
        dedent`
          Could not update existing Vitest workspace file:
          ${vitestWorkspaceFile}

          I was able to configure most of the addon but could not safely extend
          your existing workspace file automatically, you must do it yourself.

          Please refer to the documentation to complete the setup manually:
          https://storybook.js.org/docs/next/${DOCUMENTATION_LINK}#manual-setup
        `
      );
      logger.line(1);
      return;
    }
  }
  // If there's an existing Vite/Vitest config with workspaces, we update it to include the Storybook Addon Vitest plugin.
  else if (rootConfig) {
    let target, updated;
    const configFile = await fs.readFile(rootConfig, 'utf8');
    const configFileHasTypeReference = configFile.match(
      /\/\/\/\s*<reference\s+types=["']vitest\/config["']\s*\/>/
    );

    const templateName = getTemplateName();

    if (templateName) {
      const configTemplate = await loadTemplate(templateName, {
        CONFIG_DIR: options.configDir,
        SETUP_FILE: relative(dirname(rootConfig), vitestSetupFile),
      });

      const source = babelParse(configTemplate);
      target = babelParse(configFile);
      updated = updateConfigFile(source, target);
    }

    if (target && updated) {
      logger.line(1);
      logger.plain(`${step} Updating your ${vitestConfigFile ? 'Vitest' : 'Vite'} config file:`);
      logger.plain(`  ${rootConfig}`);

      const formattedContent = await formatFileContent(rootConfig, generate(target).code);
      // Only add triple slash reference to vite.config files, not vitest.config files
      // vitest.config files already have the vitest/config types available
      const shouldAddReference = !configFileHasTypeReference && !vitestConfigFile;
      await writeFile(
        rootConfig,
        shouldAddReference
          ? '/// <reference types="vitest/config" />\n' + formattedContent
          : formattedContent
      );
    } else {
      logErrors(
        '🚨 Oh no!',
        dedent`
        We were unable to update your existing ${vitestConfigFile ? 'Vitest' : 'Vite'} config file.

        Please refer to the documentation to complete the setup manually:
        https://storybook.js.org/docs/writing-tests/integrations/vitest-addon#manual-setup
      `
      );
    }
  }
  // If there's no existing Vitest/Vite config, we create a new Vitest config file.
  else {
    const newConfigFile = resolve(`vitest.config.${fileExtension}`);

    const configTemplate = await loadTemplate(getTemplateName(), {
      CONFIG_DIR: options.configDir,
      SETUP_FILE: relative(dirname(newConfigFile), vitestSetupFile),
    });

    logger.line(1);
    logger.plain(`${step} Creating a Vitest config file:`);
    logger.plain(`  ${newConfigFile}`);

    const formattedContent = await formatFileContent(newConfigFile, configTemplate);
    await writeFile(newConfigFile, formattedContent);
  }

  const a11yAddon = info.addons.find((addon) => addon.includes(addonA11yName));

  if (a11yAddon) {
    try {
      logger.plain(`${step} Setting up ${addonA11yName} for @storybook/addon-vitest:`);

      await execa(
        'storybook',
        [
          'automigrate',
          'addon-a11y-addon-test',
          '--loglevel',
          'silent',
          '--yes',
          '--skip-doctor',
          ...(options.packageManager ? ['--package-manager', options.packageManager] : []),
          ...(options.skipInstall ? ['--skip-install'] : []),
          ...(options.configDir !== '.storybook' ? ['--config-dir', `"${options.configDir}"`] : []),
        ],
        {
          stdio: 'inherit',
        }
      );
    } catch (e: unknown) {
      logErrors(
        '🚨 Oh no!',
        dedent`
        We have detected that you have ${addonA11yName} installed but could not automatically set it up for @storybook/addon-vitest:

        ${e instanceof Error ? e.message : String(e)}

        Please refer to the documentation to complete the setup manually:
        https://storybook.js.org/docs/writing-tests/accessibility-testing#test-addon-integration
      `
      );
    }
  }

  const runCommand = rootConfig ? `npx vitest --project=storybook` : `npx vitest`;

  if (!hasErrors) {
    printSuccess(
      '🎉 All done!',
      dedent`
        @storybook/addon-vitest is now configured and you're ready to run your tests!
  
        Here are a couple of tips to get you started:
        • You can run tests with "${runCommand}"
        • When using the Vitest extension in your editor, all of your stories will be shown as tests!
  
        Check the documentation for more information about its features and options at:
        https://storybook.js.org/docs/next/${DOCUMENTATION_LINK}
      `
    );
  } else {
    printWarning(
      '⚠️ Done, but with errors!',
      dedent`
        @storybook/addon-vitest was installed successfully, but there were some errors during the setup process.

        Please refer to the documentation to complete the setup manually and check the errors above:
        https://storybook.js.org/docs/next/${DOCUMENTATION_LINK}#manual-setup
      `
    );
  }

  logger.line(1);
}

async function getPackageNameFromPath(input: string): Promise<string> {
  const path = input.startsWith('file://') ? fileURLToPath(input) : input;
  if (!isAbsolute(path)) {
    return path;
  }

  const packageJsonPath = pkg.up({ cwd: path });
  if (!packageJsonPath) {
    throw new Error(`Could not find package.json in path: ${path}`);
  }

  const { default: packageJson } = await import(pathToFileURL(packageJsonPath).href, {
    with: { type: 'json' },
  });
  return packageJson.name;
}

async function getStorybookInfo({ configDir, packageManager: pkgMgr }: PostinstallOptions) {
  const packageManager = JsPackageManagerFactory.getPackageManager({ force: pkgMgr, configDir });
  const { packageJson } = packageManager.primaryPackageJson;

  const config = await loadMainConfig({ configDir });

  const { presets } = await experimental_loadStorybook({
    configDir,
    packageJson,
  });

  const framework = await presets.apply('framework', {});
  const core = await presets.apply('core', {});

  const { builder, renderer } = core;
  if (!builder) {
    throw new Error('Could not detect your Storybook builder.');
  }

  const frameworkPackageName = await getPackageNameFromPath(
    typeof framework === 'string' ? framework : framework.name
  );

  const builderPackageName = await getPackageNameFromPath(
    typeof builder === 'string' ? builder : builder.name
  );

  let rendererPackageName: string | undefined;

  if (renderer) {
    rendererPackageName = await getPackageNameFromPath(renderer);
  }

  return {
    frameworkPackageName,
    builderPackageName,
    rendererPackageName,
    addons: getAddonNames(config),
  };
}
