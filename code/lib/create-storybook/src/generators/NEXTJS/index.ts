import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { ProjectType } from 'storybook/internal/cli';
import { findFilesUp } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';
import { SupportedBuilder, SupportedFramework, SupportedRenderer } from 'storybook/internal/types';

import { dedent } from 'ts-dedent';

import { defineGeneratorModule } from '../modules/GeneratorModule';

const NEXT_CONFIG_FILES = [
  'next.config.mjs',
  'next.config.js',
  'next.config.ts',
  'next.config.mts',
];

const BABEL_CONFIG_FILES = [
  '.babelrc',
  '.babelrc.json',
  '.babelrc.js',
  '.babelrc.mjs',
  '.babelrc.cjs',
  'babel.config.js',
  'babel.config.json',
  'babel.config.mjs',
  'babel.config.cjs',
];

export default defineGeneratorModule({
  metadata: {
    projectType: ProjectType.NEXTJS,
    renderer: SupportedRenderer.REACT,
    framework: (builder: SupportedBuilder) => {
      return builder === SupportedBuilder.VITE
        ? SupportedFramework.NEXTJS_VITE
        : SupportedFramework.NEXTJS;
    },
    builderOverride: async () => {
      const nextConfigFile = findFilesUp(NEXT_CONFIG_FILES, process.cwd())[0];
      if (!nextConfigFile) {
        return SupportedBuilder.VITE;
      }

      const nextConfig = await readFile(nextConfigFile, 'utf-8');
      const hasCustomWebpackConfig = nextConfig.includes('webpack');
      const babelConfigFile = findFilesUp(BABEL_CONFIG_FILES, process.cwd())[0];

      if (!hasCustomWebpackConfig && !babelConfigFile) {
        return SupportedBuilder.VITE;
      } else {
        // prompt to ask the user which framework to select
        // based on the framework, either webpack5 or vite will be selected
        // We want to tell users in this special case, that due to their custom webpack config or babel config
        // they should select wisely, because the nextjs-vite framework may not be compatible with their setup
        const reason =
          hasCustomWebpackConfig && babelConfigFile
            ? 'custom webpack config and babel config'
            : hasCustomWebpackConfig
              ? 'custom webpack config'
              : 'custom babel config';
        logger.info(dedent`
          Storybook has two Next.js builder options: Webpack 5 and Vite.
          
          We generally recommend nextjs-vite, which is much faster, more modern, and supports our latest testing features.

          However, your project has a ${reason}, which is not supported by nextjs-vite, so please be aware of that if you choose that option.
        `);

        return prompt.select({
          message: 'Which framework would you like to use?',
          options: [
            { label: '@storybook/nextjs-vite', value: SupportedBuilder.VITE },
            { label: '@storybook/nextjs (Webpack)', value: SupportedBuilder.WEBPACK5 },
          ],
        });
      }
    },
  },
  configure: async (packageManager, context) => {
    let staticDir;

    if (existsSync(join(process.cwd(), 'public'))) {
      staticDir = 'public';
    }

    const extraPackages: string[] = [];

    if (context.builder === SupportedBuilder.VITE) {
      extraPackages.push('vite');
      // Add any Vite-specific configuration here
    }

    return {
      staticDir,
      extraPackages,
    };
  },
});
