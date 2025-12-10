import { existsSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import { writeFile } from 'node:fs/promises';

import { babelParse, generate } from 'storybook/internal/babel';
import { AddonVitestService } from 'storybook/internal/cli';
import {
  JsPackageManagerFactory,
  formatFileContent,
  getProjectRoot,
  getStorybookInfo,
} from 'storybook/internal/common';
import { CLI_COLORS } from 'storybook/internal/node-logger';
import type { StorybookError } from 'storybook/internal/server-errors';
import {
  AddonVitestPostinstallConfigUpdateError,
  AddonVitestPostinstallError,
  AddonVitestPostinstallExistingSetupFileError,
  AddonVitestPostinstallFailedAddonA11yError,
  AddonVitestPostinstallPrerequisiteCheckError,
  AddonVitestPostinstallWorkspaceUpdateError,
} from 'storybook/internal/server-errors';
import { SupportedFramework } from 'storybook/internal/types';

import * as find from 'empathic/find';
import { dirname, relative, resolve } from 'pathe';
import { satisfies } from 'semver';
import { dedent } from 'ts-dedent';

import { type PostinstallOptions } from '../../../lib/cli-storybook/src/add';
import { DOCUMENTATION_LINK } from './constants';
import { loadTemplate, updateConfigFile, updateWorkspaceFile } from './updateVitestFile';

const ADDON_NAME = '@storybook/addon-vitest' as const;
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.cts', '.mts', '.cjs', '.mjs'];

const addonA11yName = '@storybook/addon-a11y';

export default async function postInstall(options: PostinstallOptions) {
  const errors: InstanceType<typeof StorybookError>[] = [];
  const { logger, prompt } = options;

  const packageManager = JsPackageManagerFactory.getPackageManager({
    force: options.packageManager,
  });

  const findFile = (basename: string, extensions = EXTENSIONS) =>
    find.any(
      extensions.map((ext) => basename + ext),
      { last: getProjectRoot(), cwd: options.configDir }
    );

  const vitestVersionSpecifier = await packageManager.getInstalledVersion('vitest');
  logger.debug(`Vitest version specifier: ${vitestVersionSpecifier}`);
  const isVitest3_2To4 = vitestVersionSpecifier
    ? satisfies(vitestVersionSpecifier, '>=3.2.0 <4.0.0')
    : false;
  const isVitest4OrNewer = vitestVersionSpecifier
    ? satisfies(vitestVersionSpecifier, '>=4.0.0')
    : true;

  const info = await getStorybookInfo(options.configDir);
  const allDeps = packageManager.getAllDependencies();
  // only install these dependencies if they are not already installed

  const addonVitestService = new AddonVitestService(packageManager);

  // Use AddonVitestService for compatibility validation
  const compatibilityResult = await addonVitestService.validateCompatibility({
    framework: info.framework,
    builder: info.builder,
  });

  let result: string | null = null;
  if (!compatibilityResult.compatible && compatibilityResult.reasons) {
    const reasons = compatibilityResult.reasons.map((r) => `• ${CLI_COLORS.error(r)}`);
    reasons.unshift(dedent`
      Automated setup failed
      The following packages have incompatibilities that prevent automated setup:
    `);
    reasons.push(
      dedent`
        You can fix these issues and rerun the command to reinstall. If you wish to roll back the installation, remove ${ADDON_NAME} from the "addons" array
        in your main Storybook config file and remove the dependency from your package.json file.

        Please check the documentation for more information about its requirements and installation:
        https://storybook.js.org/docs/next/${DOCUMENTATION_LINK}
      `
    );

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
    const versionedDependencies = await addonVitestService.collectDependencies();

    // Print informational messages for Next.js
    if (info.framework === SupportedFramework.NEXTJS) {
      const allDeps = packageManager.getAllDependencies();
      if (!allDeps['@storybook/nextjs-vite']) {
        // TODO: Tell people to migrate first to nextjs-vite
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
    if (!options.skipInstall) {
      await addonVitestService.installPlaywright({
        yes: options.yes,
      });
    } else {
      logger.warn(dedent`
        Playwright browser binaries installation skipped. Please run the following command manually later:
        ${CLI_COLORS.cta('npx playwright install chromium --with-deps')}
      `);
    }
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
    errors.push(new AddonVitestPostinstallExistingSetupFileError({ filePath: vitestSetupFile }));
  } else {
    logger.step(`Creating a Vitest setup file for Storybook:`);
    logger.log(`${vitestSetupFile}\n`);

    const previewExists = EXTENSIONS.map((ext) => resolve(options.configDir, `preview${ext}`)).some(
      existsSync
    );

    const annotationsImport = info.frameworkPackage;

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
      errors.push(
        new AddonVitestPostinstallWorkspaceUpdateError({ filePath: vitestWorkspaceFile })
      );
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
      logger.step(`Updating your ${vitestConfigFile ? 'Vitest' : 'Vite'} config file:`);
      logger.log(`  ${rootConfig}`);

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
      logger.error(dedent`
        We were unable to update your existing ${vitestConfigFile ? 'Vitest' : 'Vite'} config file.

        Please refer to the documentation to complete the setup manually:
        https://storybook.js.org/docs/writing-tests/integrations/vitest-addon#manual-setup
      `);
      errors.push(new AddonVitestPostinstallConfigUpdateError({ filePath: rootConfig }));
    }
  }
  // If there's no existing Vitest/Vite config, we create a new Vitest config file.
  else {
    const parentDir = dirname(options.configDir);
    const newConfigFile = resolve(parentDir, `vitest.config.${fileExtension}`);

    const configTemplate = await loadTemplate(getTemplateName(), {
      CONFIG_DIR: options.configDir,
      SETUP_FILE: relative(dirname(newConfigFile), vitestSetupFile),
    });

    logger.step(`Creating a Vitest config file:`);
    logger.log(`${newConfigFile}`);

    const formattedContent = await formatFileContent(newConfigFile, configTemplate);
    await writeFile(newConfigFile, formattedContent);
  }

  const a11yAddon = info.addons.find((addon) => addon.includes(addonA11yName));

  if (a11yAddon) {
    try {
      const command = [
        'storybook',
        'automigrate',
        'addon-a11y-addon-test',
        '--loglevel',
        'silent',
        '--yes',
        '--skip-doctor',
      ];

      if (options.packageManager) {
        command.push('--package-manager', options.packageManager);
      }

      if (options.skipInstall) {
        command.push('--skip-install');
      }

      if (options.configDir !== '.storybook') {
        command.push('--config-dir', options.configDir);
      }

      await prompt.executeTask(
        // TODO: Remove stdio: 'ignore' once we have a way to log the output of the command properly
        () => packageManager.runPackageCommand({ args: command, stdio: 'ignore' }),
        {
          intro: 'Setting up a11y addon for @storybook/addon-vitest',
          error: 'Failed to setup a11y addon for @storybook/addon-vitest',
          success: 'a11y addon setup successfully',
        }
      );
    } catch (e: unknown) {
      logger.error(dedent`
        Could not automatically set up ${addonA11yName} for @storybook/addon-vitest.
        Please refer to the documentation to complete the setup manually:
        https://storybook.js.org/docs/writing-tests/accessibility-testing#test-addon-integration
      `);
      errors.push(new AddonVitestPostinstallFailedAddonA11yError({ error: e }));
    }
  }

  const runCommand = rootConfig ? `npx vitest --project=storybook` : `npx vitest`;

  if (errors.length === 0) {
    logger.step(CLI_COLORS.success('@storybook/addon-vitest setup completed successfully'));
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
