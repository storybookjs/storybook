import { findConfigFile } from 'storybook/internal/common';
import type { Options } from 'storybook/internal/types';

import type { PluginOption } from 'vite';

import { storybookConfigPlugin } from './plugins/storybook-config-plugin.ts';
import { storybookOptimizeDepsPlugin } from './plugins/storybook-optimize-deps-plugin.ts';
import { storybookProjectAnnotationsPlugin } from './plugins/storybook-project-annotations-plugin.ts';
import { storybookSanitizeEnvs } from './plugins/storybook-runtime-plugin.ts';
import { viteInjectMockerRuntime } from './plugins/vite-inject-mocker/plugin.ts';
import { viteMockPlugin } from './plugins/vite-mock/plugin.ts';

export const optimizeViteDeps: string[] = ['storybook/internal/preview/runtime'];

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
