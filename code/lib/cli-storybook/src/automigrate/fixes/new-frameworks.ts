import { getStorybookVersionSpecifier } from 'storybook/internal/cli';
import { frameworkPackages, rendererPackages } from 'storybook/internal/common';
import type { Preset } from 'storybook/internal/types';

import picocolors from 'picocolors';
import semver from 'semver';
import invariant from 'tiny-invariant';
import { dedent } from 'ts-dedent';

import { detectRenderer } from '../helpers/detectRenderer';
import {
  getFrameworkPackageName,
  getRendererPackageNameFromFramework,
  updateMainConfig,
} from '../helpers/mainConfigFile';
import {
  detectBuilderInfo,
  getNextjsAddonOptions,
  packagesMap,
} from '../helpers/new-frameworks-utils';
import type { Fix } from '../types';

const logger = console;

interface NewFrameworkRunOptions {
  mainConfigPath: string;
  dependenciesToAdd: string[];
  dependenciesToRemove: string[];
  hasFrameworkInMainConfig: boolean;
  frameworkPackage: string;
  metaFramework: string | undefined;
  renderer: string;
  addonsToRemove: string[];
  frameworkOptions: Record<string, any>;
  rendererOptions: Record<string, any>;
  addonOptions: Record<string, any>;
  builderConfig: string | Record<string, any> | undefined;
  builderInfo: {
    name: string;
    options: Record<string, any>;
  };
}

/**
 * Does the user have separate framework and builders (e.g. @storybook/react + core.builder ->
 * webpack5)?
 *
 * If so:
 *
 * - Remove the dependencies (@storybook/react + @storybook/builder-webpack5 +
 *
 * @storybook/manager-webpack5)
 * - Install the correct new package e.g. (@storybook/react-webpack5)
 * - Update the main config to use the new framework:
 * - - moving `core.builder` into `framework.options.builder`
 * - - moving renderer options (e.g. `reactOptions`) into `framework.options`
 * - - removing the now unnecessary fields in `main.ts`
 *
 * Extra step:
 * - after figuring out a candidate framework, e.g. `@storybook/react-webpack5`, check if the user has a supported meta-framework (e.g. Next.js or SvelteKit)
 * - if so, override the framework with the supporting meta-framework package e.g. `@storybook/nextjs`
 */
export const newFrameworks: Fix<NewFrameworkRunOptions> = {
  id: 'new-frameworks',

  versionRange: ['<7', '>=7'],

  async check({ configDir, packageManager, mainConfig, mainConfigPath, rendererPackage }) {
    if (typeof configDir === 'undefined') {
      return null;
    }

    const packageJson = await packageManager.retrievePackageJson();

    const frameworkPackageName = getFrameworkPackageName(mainConfig);

    const rendererPackageName =
      rendererPackage ??
      (await getRendererPackageNameFromFramework(frameworkPackageName as string)) ??
      (await detectRenderer(packageJson));

    let hasFrameworkInMainConfig = !!frameworkPackageName;

    if (frameworkPackageName && !!Object.values(rendererPackages).includes(frameworkPackageName)) {
      hasFrameworkInMainConfig = false;
    }

    const builderConfig = mainConfig.core?.builder;

    // bail if we can't detect an official renderer
    const supportedPackages = Object.keys(packagesMap);
    if (!supportedPackages.includes(rendererPackageName)) {
      return null;
    }

    const allDependencies = await packageManager.getAllDependencies();

    const builderInfo = await detectBuilderInfo({
      mainConfig,
      configDir,
      packageManager,
    });

    // if the user has a new framework already, use it
    let newFrameworkPackage = Object.keys(frameworkPackages).find(
      (pkg) => pkg === frameworkPackageName
    );

    if (!newFrameworkPackage) {
      newFrameworkPackage = packagesMap[rendererPackageName]?.[builderInfo.name];
    }

    // bail if there is no framework that matches the renderer + builder
    if (!newFrameworkPackage) {
      return null;
    }

    const renderer = rendererPackages[rendererPackageName];
    // @ts-expect-error account for renderer options for packages that supported it: reactOptions, angularOptions. (svelteOptions got removed)
    let rendererOptions = mainConfig[`${renderer}Options`] || {};

    const frameworkOptions =
      typeof mainConfig.framework === 'string' ? {} : mainConfig.framework?.options;

    let dependenciesToRemove = [
      '@storybook/builder-webpack5',
      '@storybook/manager-webpack5',
      '@storybook/builder-webpack4',
      '@storybook/manager-webpack4',
      '@storybook/builder-vite',
      'storybook-builder-vite',
    ];

    let addonsToRemove: string[] = [];
    let addonOptions: Record<string, any> = {};
    let metaFramework: string | undefined;

    const nextVersion = await packageManager.getPackageVersion('next');
    const svelteKitVersion = await packageManager.getPackageVersion('@sveltejs/kit');
    const viteVersion = await packageManager.getPackageVersion('vite');

    if (rendererPackageName === '@storybook/react' && nextVersion) {
      const nextAddonOptions = getNextjsAddonOptions(mainConfig.addons);

      const isNextJsCandidate =
        (nextVersion && semver.gte(nextVersion, '12.0.0')) ||
        Object.keys(nextAddonOptions).length > 0;

      if (isNextJsCandidate) {
        metaFramework = 'nextjs';
        if (
          newFrameworkPackage === '@storybook/react-webpack5' ||
          // when framework is already set up but maybe legacy addons are still installed
          newFrameworkPackage === '@storybook/nextjs'
        ) {
          newFrameworkPackage = '@storybook/nextjs';
          addonsToRemove = ['storybook-addon-next', 'storybook-addon-next-router'].filter(
            (dep) =>
              allDependencies[dep] ||
              mainConfig.addons?.find((addon: Preset) =>
                typeof addon === 'string' ? dep === addon : dep === addon.name
              )
          );
          addonOptions = nextAddonOptions;

          dependenciesToRemove.push(
            // in case users are coming from a properly set up @storybook/webpack5 project
            '@storybook/react-webpack5',
            'storybook-addon-next',
            'storybook-addon-next-router'
          );
        }
      }
    } else if (
      rendererPackageName === '@storybook/svelte' &&
      svelteKitVersion &&
      semver.gte(svelteKitVersion, '1.0.0')
    ) {
      metaFramework = 'sveltekit';
      if (newFrameworkPackage === '@storybook/svelte-vite') {
        newFrameworkPackage = '@storybook/sveltekit';
        // in case svelteOptions are set, we remove them as they are not needed in sveltekit
        rendererOptions = {};
        dependenciesToRemove.push(
          // in case users are coming from a properly set up @storybook/vite project
          '@storybook/svelte-vite'
        );
      }
    }

    // only install what's not already installed
    const dependenciesToAdd = [newFrameworkPackage]
      .filter((dep) => !allDependencies[dep])
      .filter(Boolean);
    // only uninstall what's installed
    dependenciesToRemove = dependenciesToRemove
      .filter((dep) => allDependencies[dep])
      .filter(Boolean);

    const isProjectAlreadyCorrect =
      hasFrameworkInMainConfig &&
      !builderConfig &&
      !Object.keys(rendererOptions).length &&
      !Object.keys(addonOptions).length &&
      !dependenciesToRemove.length &&
      !dependenciesToAdd.length;

    if (isProjectAlreadyCorrect) {
      return null;
    }

    if (viteVersion && semver.lt(viteVersion, '3.0.0')) {
      throw new Error(dedent`
        ❌ Your project should be upgraded to use the framework package ${picocolors.bold(
          newFrameworkPackage
        )}, but we detected that you are using Vite ${picocolors.bold(
          viteVersion
        )}, which is unsupported since ${picocolors.bold(
          'Storybook 7.0'
        )}. Please upgrade Vite to ${picocolors.bold('3.0.0 or higher')} and rerun this migration.
      `);
    }

    invariant(mainConfigPath, 'Missing main config path.');

    const result: Awaited<ReturnType<Fix<NewFrameworkRunOptions>['check']>> = {
      mainConfigPath,
      dependenciesToAdd,
      dependenciesToRemove,
      frameworkPackage: newFrameworkPackage,
      hasFrameworkInMainConfig,
      frameworkOptions: {
        ...frameworkOptions,
        ...rendererOptions,
        ...addonOptions,
      },
      rendererOptions,
      addonOptions,
      addonsToRemove,
      builderInfo,
      renderer,
      builderConfig,
      metaFramework,
    };
    return result;
  },

  prompt({
    dependenciesToRemove,
    dependenciesToAdd,
    hasFrameworkInMainConfig,
    mainConfigPath,
    frameworkPackage,
    addonOptions,
    renderer,
    rendererOptions,
    builderConfig,
    addonsToRemove,
    metaFramework,
  }) {
    let disclaimer = '';
    let migrationSteps = '';

    if (dependenciesToRemove.length > 0) {
      migrationSteps += `- Remove the following dependencies:
      ${dependenciesToRemove.map((dep) => `- * ${picocolors.cyan(dep)}`).join('\n')}\n`;
    }

    if (dependenciesToAdd.length > 0) {
      migrationSteps += `- Add the following dependencies: 
      ${dependenciesToAdd.map((dep) => `- * ${picocolors.cyan(dep)}`).join('\n')}\n`;
    }

    if (!hasFrameworkInMainConfig) {
      migrationSteps += `- Update or specify the ${picocolors.yellow(
        'framework'
      )} field in ${picocolors.blue(mainConfigPath)} with the value of "${picocolors.cyan(
        frameworkPackage
      )}".\n`;
    }

    if (Object.keys(rendererOptions).length > 0) {
      migrationSteps += `- Move the ${picocolors.yellow(
        `${renderer}Options`
      )} field in ${picocolors.blue(mainConfigPath)} to ${picocolors.yellow(
        'framework.options'
      )}, and remove that field entirely.
      More info: ${picocolors.yellow(
        'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#frameworkoptions-renamed'
      )}\n`;
    }

    if (addonsToRemove.length > 0) {
      migrationSteps += `- Remove the following addons from your ${picocolors.blue(
        mainConfigPath
      )}, as the new framework also supports features provided by them:
      ${addonsToRemove.map((dep) => `- * ${picocolors.cyan(dep)}`).join('\n')}
      `;
    }

    if (Object.keys(addonOptions).length > 0) {
      migrationSteps += `- Move the addon options "${picocolors.yellow(
        Object.keys(addonOptions).join(', ')
      )}" in ${picocolors.blue(mainConfigPath)} to the ${picocolors.yellow(
        'framework.options'
      )} field.\n`;
    }

    if (builderConfig) {
      if (
        typeof builderConfig === 'object' &&
        Object.keys(builderConfig.options || {}).length > 0
      ) {
        migrationSteps += `- Move the ${picocolors.yellow(
          'core.builder.options'
        )} field in ${picocolors.blue(mainConfigPath)} to ${picocolors.yellow(
          'framework.options.builder'
        )}\n`;
      }

      migrationSteps += `- Remove the ${picocolors.yellow(
        'core.builder'
      )} field in ${picocolors.blue(mainConfigPath)}.\n`;
    }

    if (
      dependenciesToRemove.includes('@storybook/builder-webpack4') ||
      dependenciesToRemove.includes('@storybook/manager-webpack4')
    ) {
      disclaimer = dedent`\n\n
      ${picocolors.underline(picocolors.bold(picocolors.cyan('Webpack 4 users')))}

      Unless you're using Storybook's Vite builder, this automigration will install a Webpack 5 based framework.
      
      Given you were using Storybook's Webpack 4 builder (default in 6.x, discontinued in 7.0), this could be a breaking change -- especially if your project has a custom webpack configuration.
      
      To learn more about migrating from Webpack4, see: ${picocolors.yellow(
        'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#webpack4-support-discontinued'
      )}`;
    }

    if (metaFramework === 'nextjs') {
      if (dependenciesToRemove.includes('storybook-addon-next-router')) {
        migrationSteps += `- Migrate the usage of the ${picocolors.cyan(
          'storybook-addon-next-router'
        )} addon to use the APIs from the ${picocolors.magenta(
          '@storybook/nextjs'
        )} framework package instead. Follow the instructions below.`;
      }

      if (frameworkPackage === '@storybook/react-vite') {
        disclaimer = dedent`\n\n
          ${picocolors.bold(
            'Important'
          )}: We've detected you are using Storybook in a Next.js project.
  
          This migration is set to update your project to use the ${picocolors.magenta(
            '@storybook/react-vite'
          )} framework, but Storybook provides a framework package specifically for Next.js projects: ${picocolors.magenta(
            '@storybook/nextjs'
          )}.
  
          This package provides a better, out of the box experience for Next.js users, however it is only compatible with the Webpack 5 builder, so we can't automigrate for you, as you are using the Vite builder. If you switch this project to use Webpack 5 and rerun this migration, we can update your project.
          
          If you are interested in using this package, see: ${picocolors.yellow(
            'https://github.com/storybookjs/storybook/blob/next/code/frameworks/nextjs/README.md'
          )}
        `;
      } else if (frameworkPackage === '@storybook/nextjs') {
        disclaimer = dedent`\n\n
        The ${picocolors.magenta(
          '@storybook/nextjs'
        )} package provides great user experience for Next.js users, and we highly recommend you to read more about it at ${picocolors.yellow(
          'https://github.com/storybookjs/storybook/blob/next/code/frameworks/nextjs/README.md'
        )}
        `;
      }
    }

    if (metaFramework === 'sveltekit') {
      if (frameworkPackage === '@storybook/svelte-webpack5') {
        disclaimer = dedent`\n\n
          ${picocolors.bold(
            'Important'
          )}: We've detected you are using Storybook in a SvelteKit project.
  
          This migration is set to update your project to use the ${picocolors.magenta(
            '@storybook/svelte-webpack5'
          )} framework, but Storybook provides a framework package specifically for SvelteKit projects: ${picocolors.magenta(
            '@storybook/sveltekit'
          )}.
  
          This package provides a better experience for SvelteKit users, however it is only compatible with the Vite builder, so we can't automigrate for you, as you are using the Webpack builder.
          
          If you are interested in using this package, see: ${picocolors.yellow(
            'https://github.com/storybookjs/storybook/blob/next/code/frameworks/sveltekit/README.md'
          )}
        `;
      } else {
        migrationSteps += `- Remove the ${picocolors.yellow(
          `${renderer}Options`
        )} field from ${picocolors.blue(mainConfigPath)}.
        More info: ${picocolors.yellow(
          'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#vite-builder-uses-vite-config-automatically'
        )}\n`;
        disclaimer = dedent`\n\n
        The ${picocolors.magenta(
          '@storybook/sveltekit'
        )} package provides great user experience for SvelteKit users, and we highly recommend you to read more about it at ${picocolors.yellow(
          'https://github.com/storybookjs/storybook/blob/next/code/frameworks/sveltekit/README.md'
        )}
        `;
      }
    }

    return dedent`
      We've detected your project is not fully setup with the new framework format, which was introduced in Storybook 7.

      Storybook 7 introduced the concept of frameworks, which abstracts configuration for renderers (e.g. React, Vue), builders (e.g. Webpack, Vite) and defaults to make integrations easier.

      Your project should be updated to use Storybook's framework: ${picocolors.magenta(
        frameworkPackage
      )}. We can attempt to do this for you automatically.

      Here are the steps this migration will do to migrate your project:
      ${migrationSteps}

      To learn more about the new framework format, see: ${picocolors.yellow(
        'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#new-framework-api'
      )}${disclaimer}
    `;
  },

  async run({
    result: {
      dependenciesToAdd,
      dependenciesToRemove,
      frameworkPackage,
      frameworkOptions,
      builderInfo,
      renderer,
      addonsToRemove,
    },
    packageManager,
    dryRun,
    mainConfigPath,
    skipInstall,
  }) {
    const packageJson = await packageManager.retrievePackageJson();
    if (dependenciesToRemove.length > 0) {
      logger.info(`✅ Removing dependencies: ${dependenciesToRemove.join(', ')}`);
      if (!dryRun) {
        await packageManager.removeDependencies(
          { skipInstall: skipInstall || dependenciesToAdd.length > 0, packageJson },
          dependenciesToRemove
        );
      }
    }

    if (dependenciesToAdd.length > 0) {
      logger.info(`✅ Installing new dependencies: ${dependenciesToAdd.join(', ')}`);
      if (!dryRun) {
        const versionToInstall = getStorybookVersionSpecifier(packageJson);
        const depsToAdd = dependenciesToAdd.map((dep) => `${dep}@${versionToInstall}`);
        await packageManager.addDependencies(
          { installAsDevDependencies: true, skipInstall, packageJson },
          depsToAdd
        );
      }
    }

    await updateMainConfig({ mainConfigPath, dryRun: !!dryRun }, async (main) => {
      logger.info(`✅ Updating main.js`);

      logger.info(`✅ Updating "framework" field`);
      if (!dryRun) {
        main.setFieldValue(['framework', 'name'], frameworkPackage);
      }

      if (!dryRun) {
        main.setFieldValue(['framework', 'options'], frameworkOptions);
      }

      if (main.getFieldNode([`${renderer}Options`])) {
        logger.info(`✅ Moving "${renderer}Options" to "framework.options"`);
        if (!dryRun) {
          main.removeField([`${renderer}Options`]);
        }
      }

      const builder = main.getFieldNode(['core', 'builder']);
      if (builder) {
        logger.info(`✅ Removing "core.builder" field`);
        if (!dryRun) {
          main.removeField(['core', 'builder']);
        }
      }

      if (Object.keys(builderInfo.options).length > 0) {
        logger.info(`✅ Moving "core.builder.options" into "framework.options.builder"`);
        if (!dryRun) {
          main.setFieldValue(['framework', 'options', 'builder'], builderInfo.options);
        }
      }

      const currentCore = main.getFieldValue(['core']);
      if (currentCore) {
        if (Object.keys(currentCore).length === 0) {
          logger.info(`✅ Removing "core" field`);
          if (!dryRun) {
            main.removeField(['core']);
          }
        }
      }

      if (addonsToRemove.length > 0) {
        const existingAddons = main.getFieldValue(['addons']) as Preset[];
        const updatedAddons = existingAddons.filter((addon) => {
          if (typeof addon === 'string') {
            return !addonsToRemove.includes(addon);
          }
          if (addon.name) {
            return !addonsToRemove.includes(addon.name);
          }

          return false;
        });
        logger.info(`✅ Removing unnecessary addons`);
        if (!dryRun) {
          main.setFieldValue(['addons'], updatedAddons);
        }
      }
    });
  },
};
