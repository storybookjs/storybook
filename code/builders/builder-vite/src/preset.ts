import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { findConfigFile } from 'storybook/internal/common';
import type { Options, PresetPropertyFn, StorybookConfigRaw } from 'storybook/internal/types';

import type { PluginOption } from 'vite';

import { storybookConfigPlugin } from './plugins/storybook-config-plugin.ts';
import { storybookOptimizeDepsPlugin } from './plugins/storybook-optimize-deps-plugin.ts';
import { storybookProjectAnnotationsPlugin } from './plugins/storybook-project-annotations-plugin.ts';
import { storybookSanitizeEnvs } from './plugins/storybook-runtime-plugin.ts';
import { viteInjectMockerRuntime } from './plugins/vite-inject-mocker/plugin.ts';
import { viteMockPlugin } from './plugins/vite-mock/plugin.ts';

export const optimizeViteDeps: string[] = ['storybook/internal/preview/runtime'];

/**
 * Mirrors Vite's default publicDir behavior via staticDirs so existing projects
 * that relied on Vite automatically serving ../public continue to work after we
 * disable publicDir in the Vite config.
 *
 * Users can opt out by explicitly setting staticDirs to an array that does not
 * include ../public, or by pointing it to a different destination with
 * { from: '../public', to: '/some-other-path' }.
 */
export const staticDirs: PresetPropertyFn<'staticDirs'> = async (
  values: StorybookConfigRaw['staticDirs'] = [],
  options: Options
) => {
  const projectRoot = resolve(options.configDir, '..');
  const defaultPublicDir = resolve(projectRoot, 'public');

  if (!existsSync(defaultPublicDir)) {
    return values;
  }

  const alreadyConfigured = values.some((dir) => {
    const from = typeof dir === 'string' ? dir : dir.from;
    return resolve(options.configDir, from) === defaultPublicDir;
  });

  if (alreadyConfigured) {
    return values;
  }

  return [...values, { from: '../public', to: '/' }];
};

/**
 * Preset that provides the core Storybook Vite plugins shared between `@storybook/builder-vite` and
 * `@storybook/addon-vitest`.
 */
export async function viteCorePlugins(
  _: PluginOption[],
  options: Options
): Promise<PluginOption[]> {
  const previewConfigPath = findConfigFile('preview', options.configDir);

  return [
    storybookProjectAnnotationsPlugin(options),
    ...storybookConfigPlugin({ configDir: options.configDir }),
    storybookOptimizeDepsPlugin(options),
    ...(await storybookSanitizeEnvs(options)),
    ...(previewConfigPath
      ? [
          viteInjectMockerRuntime({ previewConfigPath }),
          viteMockPlugin({
            previewConfigPath,
            coreOptions: await options.presets.apply('core'),
            configDir: options.configDir,
          }),
        ]
      : []),
  ];
}
