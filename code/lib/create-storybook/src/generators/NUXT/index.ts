import { baseGenerator } from '../baseGenerator';
import type { Generator } from '../types';

const generator: Generator = async (packageManager, npmOptions, options) => {
  const extraStories = options.features.includes('docs') ? ['../components/**/*.mdx'] : [];

  extraStories.push('../components/**/*.stories.@(js|jsx|ts|tsx|mdx)');

  await baseGenerator(
    packageManager,
    {
      ...npmOptions,
    },
    options,
    'vue3',
    {
      extraPackages: async () => {
        return ['@nuxtjs/storybook'];
      },
      installFrameworkPackages: false,
      componentsDestinationPath: './components',
      extraMain: {
        stories: extraStories,
      },
    },
    'nuxt'
  );

  if (npmOptions.skipInstall === true) {
    console.log(
      'The --skip-install flag is not supported for generating Storybook for Nuxt. We will continue to install dependencies.'
    );
    await packageManager.installDependencies();
  }

  // Add nuxtjs/storybook to nuxt.config.js
  await packageManager.runPackageCommand('nuxi', [
    'module',
    'add',
    '@nuxtjs/storybook',
    '--skipInstall',
  ]);
};

export default generator;
