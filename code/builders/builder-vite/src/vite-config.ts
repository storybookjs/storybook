import { resolve } from 'node:path';

import { getBuilderOptions, resolvePathInStorybookCache } from 'storybook/internal/common';
import type { Options } from 'storybook/internal/types';

import type {
  ConfigEnv,
  InlineConfig,
  PluginOption,
  UserConfig as ViteConfig,
  InlineConfig as ViteInlineConfig,
} from 'vite';

import { pluginWebpackStats, storybookEntryPlugin } from './plugins';
import { storybookDocgenPlugin } from './plugins/storybook-docgen-plugin';
import { viteCorePlugins as corePlugins } from './preset';
import type { BuilderOptions } from './types';

export type PluginConfigType = 'build' | 'development';

const configEnvServe: ConfigEnv = {
  mode: 'development',
  command: 'serve',
  isSsrBuild: false,
};

const configEnvBuild: ConfigEnv = {
  mode: 'production',
  command: 'build',
  isSsrBuild: false,
};

// Vite config that is common to development and production mode
export async function commonConfig(
  options: Options,
  _type: PluginConfigType
): Promise<ViteInlineConfig> {
  const configEnv = _type === 'development' ? configEnvServe : configEnvBuild;
  const { loadConfigFromFile, mergeConfig } = await import('vite');

  const { viteConfigPath } = await getBuilderOptions<BuilderOptions>(options);

  const projectRoot = resolve(options.configDir, '..');

  // I destructure away the `build` property from the user's config object
  // I do this because I can contain config that breaks storybook, such as we had in a lit project.
  // If the user needs to configure the `build` they need to do so in the viteFinal function in main.js.
  const { config: { build: buildProperty = undefined, ...userConfig } = {} } =
    (await loadConfigFromFile(configEnv, viteConfigPath, projectRoot)) ?? {};

  // Storybook's Vite config is assembled from self-contained plugins.
  // The config plugin handles base settings (root, cacheDir, resolve conditions, etc.),
  // while other plugins handle entry points, docgen, and runtime globals.
  // Shared vite plugins for mocking are defined in `./preset.ts` so that they can be
  // shared between @storybook/builder-vite and @storybook/addon-vitest.
  const sbConfig: InlineConfig = {
    configFile: false,
    plugins: await pluginConfig(options),
    // Pass build.target option from user's vite config
    build: {
      target: buildProperty?.target,
    },
  };

  const config: ViteConfig = mergeConfig(userConfig, sbConfig);

  return config;
}

export async function pluginConfig(options: Options) {
  const projectRoot = resolve(options.configDir, '..');

  const plugins = [
    // Shared core plugins (resolve conditions, envPrefix, fs.allow, docgen, externals, etc.)
    ...(await corePlugins([], options)),
    await storybookDocgenPlugin(options),
    // Builder-specific: root, base, and cacheDir
    {
      name: 'storybook:builder-vite-config',
      enforce: 'pre' as const,
      config() {
        return {
          root: projectRoot,
          // Allow storybook deployed as subfolder. See https://github.com/storybookjs/builder-vite/issues/238
          base: './',
          ...(options.cacheKey
            ? { cacheDir: resolvePathInStorybookCache('sb-vite', options.cacheKey) }
            : {}),
        };
      },
    },
    // Entry plugin: virtual modules for stories, addon setup, and main app entry
    ...(await storybookEntryPlugin(options)),
    // Builder-specific: webpack-compatible stats for turbosnap/chromatic
    pluginWebpackStats({ workingDir: process.cwd() }),
  ] as PluginOption[];

  return plugins;
}
