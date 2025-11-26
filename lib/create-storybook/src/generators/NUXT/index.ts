import { ProjectType } from 'storybook/internal/cli';
import { logger } from 'storybook/internal/node-logger';
import {
  Feature,
  SupportedBuilder,
  SupportedFramework,
  SupportedRenderer,
} from 'storybook/internal/types';

import { defineGeneratorModule } from '../modules/GeneratorModule';

export default defineGeneratorModule({
  metadata: {
    projectType: ProjectType.NUXT,
    renderer: SupportedRenderer.VUE3,
    framework: SupportedFramework.NUXT,
    builderOverride: SupportedBuilder.VITE,
  },
  configure: async (packageManager, context) => {
    const extraStories = context.features.has(Feature.DOCS) ? ['../components/**/*.mdx'] : [];
    extraStories.push('../components/**/*.stories.@(js|jsx|ts|tsx|mdx)');

    // Nuxt requires special handling - always install dependencies even with skipInstall
    // This is handled here to ensure Nuxt modules work correctly
    logger.info(
      'Note: Nuxt requires dependency installation to configure modules. Dependencies will be installed even if --skip-install is specified.'
    );

    // Add nuxtjs/storybook to nuxt.config.js
    await packageManager.runPackageCommand({
      args: ['nuxi', 'module', 'add', '@nuxtjs/storybook', '--skipInstall'],
    });

    return {
      extraPackages: ['@nuxtjs/storybook'],
      installFrameworkPackages: false,
      componentsDestinationPath: './components',
      extraMain: {
        stories: extraStories,
      },
    };
  },
});
