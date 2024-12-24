import { frameworkToDefaultBuilder } from 'storybook/internal/cli';
import {
  CoreBuilder,
  CoreWebpackCompilers,
  builderNameToCoreBuilder,
  compilerNameToCoreCompiler,
} from 'storybook/internal/cli';
import { frameworkPackages } from 'storybook/internal/common';
import type { SupportedFrameworks } from 'storybook/internal/types';

import picocolors from 'picocolors';
import prompts from 'prompts';
import { dedent } from 'ts-dedent';

import { add } from '../../add';
import {
  getAddonNames,
  getBuilderPackageName,
  getFrameworkOptions,
  getFrameworkPackageName,
  updateMainConfig,
} from '../helpers/mainConfigFile';
import type { Fix } from '../types';

type Options = {
  defaultCompiler?: CoreWebpackCompilers;
  shouldRemoveSWCFlag: boolean;
  isNextJs: boolean;
};

export const webpack5CompilerSetup = {
  id: 'webpack5-compiler-setup',
  versionRange: ['<8.0.0-alpha.9', '>=8.0.0-alpha.9'],
  promptType(result) {
    return result.isNextJs && !result.shouldRemoveSWCFlag ? 'notification' : 'auto';
  },

  async check({ mainConfig, packageManager }) {
    const addons = getAddonNames(mainConfig);

    if (
      addons.find(
        (addon) =>
          addon.includes(CoreWebpackCompilers.Babel) || addon.includes(CoreWebpackCompilers.SWC)
      )
    ) {
      return null;
    }

    const frameworkName = Object.entries(frameworkPackages).find(
      ([name]) => name === getFrameworkPackageName(mainConfig)
    )?.[1];

    const builderPackageName = getBuilderPackageName(mainConfig);
    const customCoreBuilder = builderPackageName
      ? builderNameToCoreBuilder[builderPackageName]
      : null;

    const defaultCoreBuilder = frameworkName
      ? frameworkToDefaultBuilder[frameworkName]
      : await (async () => {
          const webpackVersion = await packageManager.getPackageVersion('webpack');
          return !!webpackVersion ? CoreBuilder.Webpack5 : CoreBuilder.Vite;
        })();

    const builder = customCoreBuilder || defaultCoreBuilder;

    if (builder !== CoreBuilder.Webpack5) {
      return null;
    }

    const excludedFrameworks: SupportedFrameworks[] = ['angular', 'ember'];

    const isExcludedFramework = frameworkName ? excludedFrameworks.includes(frameworkName) : false;

    if (isExcludedFramework) {
      return null;
    }

    const hasReactScriptsDependency = !!(await packageManager.getPackageVersion('react-scripts'));

    if (hasReactScriptsDependency) {
      return null;
    }

    const frameworkOptions = getFrameworkOptions(mainConfig);

    const defaultCompiler = frameworkOptions?.builder?.useSWC
      ? CoreWebpackCompilers.SWC
      : CoreWebpackCompilers.Babel;

    const shouldRemoveSWCFlag = frameworkOptions?.builder
      ? 'useSWC' in frameworkOptions.builder
      : false;

    if (frameworkName === 'nextjs') {
      return {
        compiler: undefined,
        compilerPackageName: undefined,
        shouldRemoveSWCFlag,
        isNextJs: true,
      };
    }

    return {
      defaultCompiler,
      shouldRemoveSWCFlag,
      isNextJs: false,
    };
  },

  prompt({ defaultCompiler, shouldRemoveSWCFlag, isNextJs }) {
    const message = [];

    if (shouldRemoveSWCFlag) {
      message.push(dedent`
      We need to update your Storybook configuration for Webpack 5.
      The ${picocolors.yellow('framework.options.builder.useSWC')} flag will be removed.`);
    }

    if (isNextJs) {
      message.push(dedent`
      Storybook now detects whether it should use Babel or SWC as a compiler by applying the same logic as Next.js itself:\n
        - If you have a ${picocolors.yellow('.babelrc')} (or ${picocolors.yellow(
          'babel.config.js'
        )}) file in your project, Storybook will use Babel as the compiler.
        - If you have a ${picocolors.yellow('.babelrc')} (or ${picocolors.yellow(
          'babel.config.js'
        )}) file in your project and you have set 
          ${picocolors.yellow(
            'experimental.forceSwcTransforms = true'
          )} in your ${picocolors.yellow('next.config.js')} file, 
          Storybook will use SWC as the compiler.
        - If you don't have a ${picocolors.yellow('.babelrc')} (or ${picocolors.yellow(
          'babel.config.js'
        )}) file in your project, Storybook will use SWC as the compiler.
      `);
    } else if (defaultCompiler === CoreWebpackCompilers.Babel) {
      message.push(dedent`
      Storybook's Webpack5 builder is now compiler agnostic, meaning you can choose a compiler addon that best fits your project:\n
        - Babel: A vast ecosystem and is battle-tested. It's a robust choice if you have an extensive Babel setup or need specific Babel plugins for your project.
        - SWC:  Fast and easy to configure. Ideal if you want faster builds and have a straightforward configuration without the need for Babel's extensibility.\n
      In the next step, Storybook will ask you to choose a compiler to automatically set it up for you.\n
      After the migration, you can switch Webpack5 compilers by swapping the addon in your project.
      You can find more information here: ${picocolors.yellow(
        'https://storybook.js.org/docs/builders/webpack#compiler-support'
      )}
      `);
    } else {
      message.push(dedent`
      Storybook's Webpack5 builder is now compiler agnostic, meaning you have to install an additional addon to set up a compiler for Webpack5.\n
      We have detected, that you want to use SWC as the compiler for Webpack5.\n
      In the next step, Storybook will install @storybook/addon-webpack5-compiler-swc and will add it to your addons list in your Storybook config.\n
      After the migration, you can switch Webpack5 compilers by swapping the addon in your project.
      You can find more information here: ${picocolors.yellow(
        'https://storybook.js.org/docs/builders/webpack#compiler-support'
      )}
      `);
    }

    return message.join('\n\n');
  },

  async run({ result, mainConfigPath, packageManager, skipInstall, dryRun }) {
    const { defaultCompiler, shouldRemoveSWCFlag, isNextJs } = result;

    if (shouldRemoveSWCFlag) {
      await updateMainConfig({ mainConfigPath, dryRun: !!dryRun }, (main) => {
        main.removeField(['framework', 'options', 'builder', 'useSWC']);
      });
    }

    if (!isNextJs) {
      const compiler: CoreWebpackCompilers =
        defaultCompiler === CoreWebpackCompilers.Babel
          ? await askUserForCompilerChoice()
          : CoreWebpackCompilers.SWC;

      const compilerPackageName = Object.entries(compilerNameToCoreCompiler).find(
        ([, coreCompiler]) => coreCompiler === compiler
      )![0];

      await add(compilerPackageName, {
        packageManager: packageManager.type,
        skipPostinstall: !!skipInstall,
      });
    }
  },
} satisfies Fix<Options>;

async function askUserForCompilerChoice() {
  const response = await prompts<'compiler'>({
    type: 'select',
    name: 'compiler',
    message: `Which compiler would you like to use?`,
    choices: [
      {
        title: 'Babel',
        description: 'Choose Babel for a vast ecosystem and battle-tested reliability.',
        value: CoreWebpackCompilers.Babel,
      },
      {
        title: 'SWC',
        description: 'Choose SWC for fast builds and simple configuration.',
        value: CoreWebpackCompilers.SWC,
      },
    ],
    initial: 0,
  });

  return response.compiler as CoreWebpackCompilers;
}
