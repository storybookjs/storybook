import { existsSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import { writeFile } from 'node:fs/promises';
import { isAbsolute, posix, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { babelParse, generate, traverse } from 'storybook/internal/babel';
import { AddonVitestService } from 'storybook/internal/cli';
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
import { CLI_COLORS, logger, prompt } from 'storybook/internal/node-logger';
import {
  AddonVitestPostinstallError,
  AddonVitestPostinstallPrerequisiteCheckError,
} from 'storybook/internal/server-errors';

import * as find from 'empathic/find';
import * as pkg from 'empathic/package';
import { dirname, relative, resolve } from 'pathe';
import { satisfies } from 'semver';
import { dedent } from 'ts-dedent';

import { type PostinstallOptions } from '../../../lib/cli-storybook/src/add';
import { DOCUMENTATION_LINK, SUPPORTED_FRAMEWORKS } from './constants';
import { loadTemplate, updateConfigFile, updateWorkspaceFile } from './updateVitestFile';
import { getAddonNames } from './utils';

const ADDON_NAME = '@storybook/addon-vitest' as const;
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.cts', '.mts', '.cjs', '.mjs'];

const addonA11yName = '@storybook/addon-a11y';

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

const findFile = (basename: string, extensions = EXTENSIONS) =>
  find.any(
    extensions.map((ext) => basename + ext),
    { last: getProjectRoot() }
  );

export default async function postInstall(options: PostinstallOptions) {
  const errors: string[] = [];
  const packageManager = JsPackageManagerFactory.getPackageManager({
    force: options.packageManager,
  });

  const info = await getStorybookInfo(options);
  const allDeps = packageManager.getAllDependencies();

  // Get vitest version info for config template compatibility
  const vitestVersionSpecifier = await packageManager.getInstalledVersion('vitest');
  const isVitest3_2OrNewer = vitestVersionSpecifier
    ? satisfies(vitestVersionSpecifier, '>=3.2.0')
    : true;

  const mainJsPath = getInterpretedFile(resolve(options.configDir, 'main')) as string;
  const config = await readConfig(mainJsPath);

  const hasCustomWebpackConfig = !!config.getFieldNode(['webpackFinal']);

  const isInteractive = process.stdout.isTTY && !isCI();

  if (nameMatches(info.frameworkPackageName, '@storybook/nextjs') && !hasCustomWebpackConfig) {
    let isMigrateToNextjsVite;

    if (options.yes || !isInteractive) {
      isMigrateToNextjsVite = !!options.yes;
    } else {
      isMigrateToNextjsVite = await prompt.confirm({
        message: dedent`
        The addon requires @storybook/nextjs-vite to work with Next.js.
        https://storybook.js.org/docs/next/${DOCUMENTATION_LINK}#install-and-set-up
        Do you want to migrate?
      `,
        initialValue: true,
      });
    }

    if (isMigrateToNextjsVite) {
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

  // Use AddonVitestService for compatibility validation
  const addonVitestService = new AddonVitestService();
  const compatibilityResult = await addonVitestService.validateCompatibility({
    packageManager,
    frameworkPackageName: info.frameworkPackageName,
    builderPackageName: info.builderPackageName,
    hasCustomWebpackConfig,
    configDir: options.configDir,
  });

  let result: string | null = null;
  if (!compatibilityResult.compatible && compatibilityResult.reasons) {
    const reasons = compatibilityResult.reasons.map((r) => `• ${CLI_COLORS.error(r)}`);
    reasons.unshift(dedent`
      Automated setup failed
      We have found incompatibilities due to the following package incompatibilities:
    `);
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

    result = reasons.map((r) => r.trim()).join('\n\n');
  }

  if (result) {
    logger.error(result);
    throw new AddonVitestPostinstallPrerequisiteCheckError({
      reasons: compatibilityResult.reasons!,
    });
  }

  // Skip all dependency management when flag is set (called from init command)
  if (!options.skipDependencyManagement) {
    // Use AddonVitestService for dependency collection
    const versionedDependencies = await addonVitestService.collectDependencies(
      packageManager,
      info.frameworkPackageName
    );

    // Print informational messages for Next.js
    if (info.frameworkPackageName === '@storybook/nextjs') {
      const allDeps = packageManager.getAllDependencies();
      if (!allDeps['@storybook/nextjs-vite']) {
        logger.step(
          dedent`
          It looks like you're using Next.js.
          Adding "@storybook/nextjs-vite/vite-plugin" so you can use it with Vitest.
          More info about the plugin at https://github.com/storybookjs/vite-plugin-storybook-nextjs
        `
        );
      }
    }

    // Print informational message for coverage reporter
    const v8Version = await packageManager.getInstalledVersion('@vitest/coverage-v8');
    const istanbulVersion = await packageManager.getInstalledVersion('@vitest/coverage-istanbul');
    if (!v8Version && !istanbulVersion) {
      logger.step(
        dedent`
          You don't seem to have a coverage reporter installed. Vitest needs either V8 or Istanbul to generate coverage reports.

          Adding "@vitest/coverage-v8" to enable coverage reporting.
          Read more about Vitest coverage providers at https://vitest.dev/guide/coverage.html#coverage-providers
        `
      );
    }

    if (versionedDependencies.length > 0) {
      logger.step('Adding dependencies to your package.json');
      logger.log('  ' + versionedDependencies.join(', '));

      await packageManager.addDependencies(
        { type: 'devDependencies', skipInstall: true },
        versionedDependencies
      );
    }

    if (!options.skipInstall) {
      await packageManager.installDependencies();
    }
  }

  // Install Playwright browser binaries using AddonVitestService
  if (!options.skipDependencyManagement) {
    const playwrightErrors = await addonVitestService.installPlaywright(packageManager, {
      skipInstall: options.skipInstall,
    });
    errors.push(...playwrightErrors);
  }

  const fileExtension =
    allDeps.typescript || findFile('tsconfig', [...EXTENSIONS, '.json']) ? 'ts' : 'js';

  const vitestSetupFile = resolve(options.configDir, `vitest.setup.${fileExtension}`);

  if (existsSync(vitestSetupFile)) {
    const errorMessage = dedent`
    Found an existing Vitest setup file:
    ${vitestSetupFile}
    Please refer to the documentation to complete the setup manually:
    https://storybook.js.org/docs/next/${DOCUMENTATION_LINK}#manual-setup
  `;
    logger.line();
    logger.error(`${errorMessage}\n`);
    errors.push('Found existing Vitest setup file');
  } else {
    logger.step(`Creating a Vitest setup file for Storybook:`);
    logger.log(`${vitestSetupFile}\n`);

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
  }

  const vitestWorkspaceFile =
    findFile('vitest.workspace', ['.ts', '.js', '.json']) ||
    findFile('vitest.projects', ['.ts', '.js', '.json']);
  const viteConfigFile = findFile('vite.config');
  const vitestConfigFile = findFile('vitest.config');
  const vitestShimFile = findFile('vitest.shims.d');
  const rootConfig = vitestConfigFile || viteConfigFile;

  const browserConfig = `{
        enabled: true,
        headless: true,
        provider: 'playwright',
        instances: [{ browser: 'chromium' }]
      }`;

  if (fileExtension === 'ts' && !vitestShimFile) {
    await writeFile(
      'vitest.shims.d.ts',
      '/// <reference types="@vitest/browser/providers/playwright" />'
    );
  }

  // If there's an existing workspace file, we update that file to include the Storybook Addon Vitest plugin.
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
      logger.step(`Updating your Vitest workspace file...`);

      logger.log(`${vitestWorkspaceFile}`);

      const formattedContent = await formatFileContent(vitestWorkspaceFile, generate(target).code);
      await writeFile(vitestWorkspaceFile, formattedContent);
    } else {
      logger.error(
        dedent`
          Could not update existing Vitest workspace file:
          ${vitestWorkspaceFile}

          I was able to configure most of the addon but could not safely extend
          your existing workspace file automatically, you must do it yourself.

          Please refer to the documentation to complete the setup manually:
          https://storybook.js.org/docs/next/${DOCUMENTATION_LINK}#manual-setup
        `
      );
      errors.push('Unable to update existing Vitest workspace file');
    }
  }
  // If there's an existing Vite/Vitest config with workspaces, we update it to include the Storybook Addon Vitest plugin.
  else if (rootConfig) {
    let target, updated;
    const configFile = await fs.readFile(rootConfig, 'utf8');
    const hasProjectsConfig = configFile.includes('projects:');
    const configFileHasTypeReference = configFile.match(
      /\/\/\/\s*<reference\s+types=["']vitest\/config["']\s*\/>/
    );

    const templateName =
      hasProjectsConfig || isVitest3_2OrNewer
        ? 'vitest.config.3.2.template.ts'
        : 'vitest.config.template.ts';

    if (templateName) {
      const configTemplate = await loadTemplate(templateName, {
        CONFIG_DIR: options.configDir,
        BROWSER_CONFIG: browserConfig,
        SETUP_FILE: relative(dirname(rootConfig), vitestSetupFile),
      });

      const source = babelParse(configTemplate);
      target = babelParse(configFile);
      updated = updateConfigFile(source, target);
    }

    if (target && updated) {
      logger.step(`Updating your ${vitestConfigFile ? 'Vitest' : 'Vite'} config file:`);
      logger.log(`  ${rootConfig}`);

      const formattedContent = await formatFileContent(rootConfig, generate(target).code);
      await writeFile(
        rootConfig,
        configFileHasTypeReference
          ? formattedContent
          : '/// <reference types="vitest/config" />\n' + formattedContent
      );
    } else {
      logger.error(dedent`
        We were unable to update your existing ${vitestConfigFile ? 'Vitest' : 'Vite'} config file.

        Please refer to the documentation to complete the setup manually:
        https://storybook.js.org/docs/writing-tests/integrations/vitest-addon#manual-setup
      `);
      errors.push('Unable to update existing Vitest config file');
    }
  }
  // If there's no existing Vitest/Vite config, we create a new Vitest config file.
  else {
    const newConfigFile = resolve(`vitest.config.${fileExtension}`);
    const configTemplate = await loadTemplate(
      isVitest3_2OrNewer ? 'vitest.config.3.2.template.ts' : 'vitest.config.template.ts',
      {
        CONFIG_DIR: options.configDir,
        BROWSER_CONFIG: browserConfig,
        SETUP_FILE: relative(dirname(newConfigFile), vitestSetupFile),
      }
    );

    logger.step(`Creating a Vitest config file:`);
    logger.log(`${newConfigFile}`);

    const formattedContent = await formatFileContent(newConfigFile, configTemplate);
    await writeFile(newConfigFile, formattedContent);
  }

  const a11yAddon = info.addons.find((addon) => addon.includes(addonA11yName));

  if (a11yAddon) {
    try {
      const command = ['storybook', 'automigrate', 'addon-a11y-addon-test'];

      command.push('--loglevel', 'silent');
      command.push('--yes', '--skip-doctor');

      if (options.packageManager) {
        command.push('--package-manager', options.packageManager);
      }

      if (options.skipInstall) {
        command.push('--skip-install');
      }

      if (options.configDir !== '.storybook') {
        command.push('--config-dir', `"${options.configDir}"`);
      }

      await prompt.executeTask(
        () => packageManager.executeCommand({ command: 'npx', args: command }),
        {
          id: 'a11y-addon-setup',
          intro: 'Setting up a11y addon for @storybook/addon-vitest',
          error: 'Failed to setup a11y addon for @storybook/addon-vitest',
          success: 'a11y addon setup successfully',
        }
      );
    } catch (e: unknown) {
      console.log(e);
      logger.line();
      logger.error(dedent`
        Could not automatically set up ${addonA11yName} for @storybook/addon-vitest.
        Please refer to the documentation to complete the setup manually:
        https://storybook.js.org/docs/writing-tests/accessibility-testing#test-addon-integration
      `);
      errors.push(
        "The @storybook/addon-a11y couldn't be set up for the Vitest addon" +
          (e instanceof Error ? e.stack : String(e))
      );
    }
  }

  const runCommand = rootConfig ? `npx vitest --project=storybook` : `npx vitest`;

  logger.line();
  if (errors.length === 0) {
    logger.step(CLI_COLORS.success('All done!'));
    logger.log(dedent`
        @storybook/addon-vitest is now configured and you're ready to run your tests!
        Here are a couple of tips to get you started:

        • You can run tests with "${CLI_COLORS.cta(runCommand)}"
        • Vitest IDE extension shows all stories as tests in your editor!

        Check the documentation for more information about its features and options at:
        https://storybook.js.org/docs/next/${DOCUMENTATION_LINK}
      `);
  } else {
    logger.warn(
      dedent`
        Done, but with errors!
        @storybook/addon-vitest was installed successfully, but there were some errors during the setup process. Please refer to the documentation to complete the setup manually and check the errors above:
        https://storybook.js.org/docs/next/${DOCUMENTATION_LINK}#manual-setup
      `
    );
    throw new AddonVitestPostinstallError({ errors });
  }
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
