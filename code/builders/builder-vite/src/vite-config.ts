import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { getBuilderOptions, resolvePathInStorybookCache } from 'storybook/internal/common';
import { once } from 'storybook/internal/node-logger';
import type { Options } from 'storybook/internal/types';

import { dedent } from 'ts-dedent';
import type {
  ConfigEnv,
  InlineConfig,
  PluginOption,
  UserConfig as ViteConfig,
  InlineConfig as ViteInlineConfig,
} from 'vite';

import {
  pluginWebpackStats,
  storybookEntryPlugin,
  storybookExternalGlobalsPlugin,
} from './plugins/index.ts';
import { viteCorePlugins as corePlugins } from './preset.ts';
import type { BuilderOptions } from './types.ts';

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

// Mirrors Vite's own config-file search list (see Vite's `DEFAULT_CONFIG_FILES`).
const DEFAULT_VITE_CONFIG_FILES = [
  'vite.config.js',
  'vite.config.mjs',
  'vite.config.ts',
  'vite.config.cjs',
  'vite.config.mts',
  'vite.config.cts',
];

const warnOnce = once('warn');

/**
 * Vite's `loadConfigFromFile` resolves `null` — silently, without logging anything — when it
 * cannot find a Vite config file. Discovery only searches the parent directory of the Storybook
 * config dir, so a config that lives elsewhere in the project (e.g. the repository root above a
 * nested config dir) is silently ignored and Storybook boots with the user's Vite settings
 * unapplied. Make that case loud, while a project with no Vite config at all stays quiet.
 */
function reportUnloadedUserViteConfig(configDir: string, projectRoot: string): void {
  // Walk upwards within the project (bounded by the repository root) for a Vite config that
  // discovery could not see. Nothing found means the project has no Vite config at all, which
  // is common and stays quiet.
  let dir = projectRoot;
  let unloadedConfig: string | undefined;

  while (dir) {
    unloadedConfig = DEFAULT_VITE_CONFIG_FILES.map((filename) => resolve(dir, filename)).find(
      (candidate) => existsSync(candidate)
    );

    if (unloadedConfig || existsSync(resolve(dir, '.git'))) {
      break;
    }

    const parent = resolve(dir, '..');
    if (parent === dir) {
      break; // Reached the filesystem root
    }
    dir = parent;
  }

  if (!unloadedConfig) {
    return;
  }

  warnOnce(
    dedent`
      No user Vite config was loaded: Storybook auto-discovers a Vite config file in "${projectRoot}" (the directory above your Storybook config dir "${configDir}"), and none was found there.
      A Vite config was found at "${unloadedConfig}", but it is outside of that directory and was not loaded.
      To load it, point the "viteConfigPath" builder option at it, e.g. core: { builder: { options: { viteConfigPath: '${unloadedConfig}' } } }.
      See: https://storybook.js.org/docs/builders/vite#override-the-default-configuration
    `
  );
}

async function loadUserViteConfig(options: Options, type: PluginConfigType): Promise<ViteConfig> {
  const configEnv = type === 'development' ? configEnvServe : configEnvBuild;
  const { loadConfigFromFile } = await import('vite');
  const { viteConfigPath, configLoader } = await getBuilderOptions<BuilderOptions>(options);
  const projectRoot = resolve(options.configDir, '..');

  const loaded = await loadConfigFromFile(
    configEnv,
    viteConfigPath,
    projectRoot,
    undefined,
    undefined,
    configLoader
  );

  // An explicit `viteConfigPath` means the user owns config resolution: Vite either loads it or
  // errors on it. Only the automatic discovery path can miss silently.
  if (!loaded && !viteConfigPath) {
    reportUnloadedUserViteConfig(options.configDir, projectRoot);
  }

  return loaded?.config ?? {};
}

// Mirrors Vite's own resolution: `publicDir` is relative to the root Storybook sets in
// `commonConfig`, and `false` or an empty string disables it.
export async function resolveVitePublicDir(
  options: Options,
  type: PluginConfigType
): Promise<string | undefined> {
  const { publicDir } = await loadUserViteConfig(options, type);

  if (publicDir === false || publicDir === '') {
    return undefined;
  }

  const resolved = resolve(options.configDir, '..', publicDir ?? 'public');

  return existsSync(resolved) ? resolved : undefined;
}

// Vite config that is common to development and production mode
export async function commonConfig(
  options: Options,
  _type: PluginConfigType
): Promise<ViteInlineConfig> {
  const { mergeConfig } = await import('vite');

  const projectRoot = resolve(options.configDir, '..');

  // I destructure away the `build` property from the user's config object
  // I do this because I can contain config that breaks storybook, such as we had in a lit project.
  // If the user needs to configure the `build` they need to do so in the viteFinal function in main.js.
  const { build: buildProperty = undefined, ...userConfig } = await loadUserViteConfig(
    options,
    _type
  );

  // Storybook's Vite config is assembled from self-contained plugins.
  // The config plugin handles base settings (root, cacheDir, resolve conditions, etc.),
  // while other plugins handle entry points, docgen, and runtime globals.
  // Shared vite plugins for mocking are defined in `./preset.ts` so that they can be
  // shared between @storybook/builder-vite and @storybook/addon-vitest.
  const sbConfig: InlineConfig = {
    configFile: false,
    plugins: await pluginConfig(options),
    root: projectRoot,
    // Allow storybook deployed as subfolder. See https://github.com/storybookjs/builder-vite/issues/238
    base: './',
    ...(options.cacheKey
      ? { cacheDir: resolvePathInStorybookCache('sb-vite', options.cacheKey) }
      : {}),
    // Pass build.target option from user's vite config
    build: {
      target: buildProperty?.target,
    },
  };

  const config: ViteConfig = mergeConfig(userConfig, sbConfig);

  return config;
}

export async function pluginConfig(options: Options) {
  const plugins = [
    // Shared core plugins (resolve conditions, envPrefix, fs.allow, externals, env vars, etc.)
    ...(await corePlugins([], options)),
    await storybookExternalGlobalsPlugin(options),
    // Entry plugin: virtual modules for stories, addon setup, and main app entry
    ...(await storybookEntryPlugin(options)),
    // Builder-specific: webpack-compatible stats for turbosnap/chromatic
    pluginWebpackStats({ workingDir: process.cwd() }),
  ] as PluginOption[];

  return plugins;
}
