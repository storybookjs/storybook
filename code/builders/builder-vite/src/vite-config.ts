import { existsSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import { getProjectRoot, resolvePathInStorybookCache } from '@storybook/core/internal/common';
import type { HookContext, Storybook } from '@storybook/core';
import { once } from '@storybook/core/internal/node-logger';
import type { PreviewSources } from '@storybook/core/internal/preview-page';

import * as find from 'empathic/find';
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
import { storybookConfigPlugin } from './plugins/storybook-config-plugin.ts';
import { storybookOptimizeDepsPlugin } from './plugins/storybook-optimize-deps-plugin.ts';
import { storybookProjectAnnotationsPlugin } from './plugins/storybook-project-annotations-plugin.ts';
import { storybookEnvPlugin } from './plugins/storybook-runtime-plugin.ts';
import { viteInjectMockerRuntime } from './plugins/vite-inject-mocker/plugin.ts';
import { viteMockPlugin } from './plugins/vite-mock/plugin.ts';
import type { BuilderOptions } from './types.ts';

export type PluginConfigType = 'build' | 'development';

/** Inputs every Vite config of one builder shares. */
export interface ViteConfigInput {
  preview: PreviewSources;
  options: BuilderOptions | undefined;
}

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

/** Create the Vite plugins shared by the builder and the Vitest addon. */
export async function viteCorePlugins(
  storybook: Storybook,
  preview: PreviewSources
): Promise<PluginOption[]> {
  const { previewConfigPath } = preview;

  return [
    storybookProjectAnnotationsPlugin(preview),
    ...storybookConfigPlugin({ configDir: storybook.configDir }),
    storybookOptimizeDepsPlugin(storybook, preview),
    storybookEnvPlugin(preview),
    ...(previewConfigPath
      ? [
          viteInjectMockerRuntime({ previewConfigPath }),
          viteMockPlugin({
            previewConfigPath,
            coreOptions: await storybook.callHook('core:config:extend', undefined),
            configDir: storybook.configDir,
          }),
        ]
      : []),
  ];
}

/** Pass the instance options to `builder:vite:extend` handlers, as `viteFinal` received them. */
export function getViteHookContext(storybook: Storybook): HookContext {
  const { docs: _docs, ...options } = storybook.options;
  return { ...options, channel: storybook.channel };
}

// loadConfigFromFile returns null without logging when discovery misses.
function reportUnloadedUserViteConfig(configDir: string, projectRoot: string): void {
  const root = getProjectRoot();

  // `last` bounds the search only when the config dir's parent lies inside the project root.
  // Outside layouts (e.g. `storybook dev -c ../shared/.storybook`) would search to the filesystem
  // root and can name unrelated configs, so stay quiet there.
  if (relative(root, projectRoot).startsWith('..')) {
    return;
  }

  const unloadedConfig = find.any(DEFAULT_VITE_CONFIG_FILES, {
    cwd: projectRoot,
    last: root,
  });

  if (!unloadedConfig) {
    return;
  }

  warnOnce(
    dedent`
      No user Vite config was loaded: Storybook auto-discovers a Vite config file in "${projectRoot}" (the directory above your Storybook config dir "${configDir}"), and none was found there.
      A Vite config was found at "${unloadedConfig}", but it is outside of that directory and was not loaded.
      To load it, point the "viteConfigPath" builder option at it, e.g. core: { builder: { options: { viteConfigPath: '${unloadedConfig}' } } }.
      To keep it unloaded and silence this warning, set "viteConfigPath" to null, e.g. core: { builder: { options: { viteConfigPath: null } } }.
      See: https://storybook.js.org/docs/builders/vite#override-the-default-configuration
    `
  );
}

// `framework.options.builder` wins over factory options, then `main.ts` `core.builder.options`.
async function resolveBuilderOptions(
  storybook: Pick<Storybook, 'callHook'>,
  options: BuilderOptions | undefined
): Promise<BuilderOptions> {
  const [framework, core] = await Promise.all([
    storybook.callHook('core:framework:extend', undefined),
    storybook.callHook('core:config:extend', undefined),
  ]);
  return (
    (typeof framework === 'object' && framework?.options?.builder) ||
    options ||
    (typeof core?.builder === 'object' && core.builder.options) ||
    {}
  );
}

async function loadUserViteConfig(
  storybook: Pick<Storybook, 'configDir' | 'callHook'>,
  options: BuilderOptions | undefined,
  type: PluginConfigType
): Promise<ViteConfig> {
  const configEnv = type === 'development' ? configEnvServe : configEnvBuild;
  const { loadConfigFromFile } = await import('vite');
  const { viteConfigPath, configLoader } = await resolveBuilderOptions(storybook, options);
  const projectRoot = resolve(storybook.configDir, '..');

  // Explicit `null` opts out: keep the user's Vite config unloaded and stay quiet.
  if (viteConfigPath === null) {
    return {};
  }

  const loaded = await loadConfigFromFile(
    configEnv,
    viteConfigPath,
    projectRoot,
    undefined,
    undefined,
    configLoader
  );

  // An explicit `viteConfigPath` is the user's responsibility; Vite errors on it itself.
  if (!loaded && viteConfigPath === undefined) {
    reportUnloadedUserViteConfig(storybook.configDir, projectRoot);
  }

  return loaded?.config ?? {};
}

// Mirrors Vite's own resolution: `publicDir` is relative to the root Storybook sets in
// `commonConfig`, and `false` or an empty string disables it.
export async function resolveVitePublicDir(
  storybook: Pick<Storybook, 'configDir' | 'callHook'>,
  options: BuilderOptions | undefined
): Promise<string | undefined> {
  const { publicDir } = await loadUserViteConfig(storybook, options, 'build');

  if (publicDir === false || publicDir === '') {
    return undefined;
  }

  const resolved = resolve(storybook.configDir, '..', publicDir ?? 'public');

  return existsSync(resolved) ? resolved : undefined;
}

// Vite config that is common to development and production mode
export async function commonConfig(
  storybook: Storybook,
  { preview, options }: ViteConfigInput,
  type: PluginConfigType
): Promise<ViteInlineConfig> {
  const { mergeConfig } = await import('vite');

  const projectRoot = resolve(storybook.configDir, '..');
  const { cacheKey } = storybook.options;

  // The user's `build` options can break Storybook; only `build.target` is kept, the rest goes
  // through `viteFinal`.
  const { build: buildProperty = undefined, ...userConfig } = await loadUserViteConfig(
    storybook,
    options,
    type
  );

  const sbConfig: InlineConfig = {
    configFile: false,
    plugins: await pluginConfig(storybook, preview),
    root: projectRoot,
    // Allow storybook deployed as subfolder. See https://github.com/storybookjs/builder-vite/issues/238
    base: './',
    ...(cacheKey ? { cacheDir: resolvePathInStorybookCache('sb-vite', cacheKey) } : {}),
    build: {
      target: buildProperty?.target,
    },
  };

  return mergeConfig(userConfig, sbConfig);
}

export async function pluginConfig(
  storybook: Storybook,
  preview: PreviewSources
): Promise<PluginOption[]> {
  return [
    ...(await viteCorePlugins(storybook, preview)),
    await storybookExternalGlobalsPlugin(preview),
    ...(await storybookEntryPlugin(storybook, preview)),
    pluginWebpackStats({ workingDir: process.cwd(), virtualModuleIds: preview.virtualModuleIds }),
  ];
}
