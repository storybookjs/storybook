import { dedent } from 'ts-dedent';
import type { Fix } from '../types';
import { findUp } from 'find-up';
import { getFrameworkPackageName } from '../helpers/mainConfigFile';
import { frameworkToRenderer } from 'storybook/internal/cli';
import { frameworkPackages } from 'storybook/internal/common';
import path from 'path';

interface ViteConfigFileRunOptions {
  plugins: string[];
  existed: boolean;
}

export const viteConfigFile = {
  id: 'viteConfigFile',

  versionRange: ['<8.0.0-beta.3', '>=8.0.0-beta.3'],

  promptType: 'notification',

  async check({ mainConfig, packageManager, mainConfigPath }) {
    let isViteConfigFileFound = !!(await findUp(
      ['vite.config.js', 'vite.config.mjs', 'vite.config.cjs', 'vite.config.ts', 'vite.config.mts'],
      { cwd: mainConfigPath ? path.join(mainConfigPath, '..') : process.cwd() }
    ));

    const rendererToVitePluginMap: Record<string, string> = {
      preact: '@preact/preset-vite',
      qwik: 'vite-plugin-qwik',
      react: '@vitejs/plugin-react',
      solid: 'vite-plugin-solid',
      svelte: '@sveltejs/vite-plugin-svelte',
      sveltekit: '@sveltejs/kit/vite', // might be pointless?
      vue: '@vitejs/plugin-vue',
    };

    const frameworkPackageName = getFrameworkPackageName(mainConfig);
    if (!frameworkPackageName) {
      return null;
    }
    const frameworkName = frameworkPackages[frameworkPackageName];
    const isUsingViteBuilder =
      mainConfig.core?.builder === 'vite' ||
      frameworkPackageName?.includes('vite') ||
      frameworkPackageName === 'qwik' ||
      frameworkPackageName === 'solid' ||
      frameworkPackageName === 'sveltekit';

    const rendererName = frameworkToRenderer[frameworkName as keyof typeof frameworkToRenderer];

    if (
      !isViteConfigFileFound &&
      mainConfig.core?.builder &&
      typeof mainConfig.core?.builder !== 'string' &&
      mainConfig.core?.builder.options
    ) {
      isViteConfigFileFound = !!mainConfig.core?.builder.options.viteConfigPath;
    }

    if (!isViteConfigFileFound && isUsingViteBuilder) {
      const plugins = [];

      if (rendererToVitePluginMap[rendererName]) {
        plugins.push(rendererToVitePluginMap[rendererName]);
      }

      return {
        plugins,
        existed: isViteConfigFileFound,
      };
    }

    const plugin = rendererToVitePluginMap[rendererName];

    if (!plugin) {
      return null;
    }

    const pluginVersion = await packageManager.getPackageVersion(plugin);

    if (isViteConfigFileFound && isUsingViteBuilder && !pluginVersion) {
      const plugins = [];

      if (plugin) {
        plugins.push(plugin);
      }

      return {
        plugins,
        existed: !isViteConfigFileFound,
      };
    }

    return null;
  },

  prompt({ existed, plugins }) {
    if (existed) {
      return dedent`
        Since version 8.0.0, Storybook no longer ships with an in-built Vite config.
        We've detected you do have a Vite config, but you may be missing the following plugins in it.

        ${plugins.map((plugin) => `  - ${plugin}`).join('\n')}

        If you already have these plugins, you can ignore this message.

        You can find more information on how to do this here:
        https://storybook.js.org/docs/8.0/migration-guide/#missing-viteconfigjs-file

        This change was necessary to support newer versions of Vite.
      `;
    }
    return dedent`
      Since version 8.0.0, Storybook no longer ships with an in-built Vite config.
      Please add a vite.config.js file to your project root.

      You can find more information on how to do this here:
      https://storybook.js.org/docs/8.0/migration-guide/#missing-viteconfigjs-file

      This change was necessary to support newer versions of Vite.
    `;
  },
} satisfies Fix<ViteConfigFileRunOptions>;
