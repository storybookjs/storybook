import { findConfigFile } from 'storybook/internal/common';
import type { Options } from 'storybook/internal/types';

import type { PluginOption } from 'vite';

import { storybookConfigPlugin } from './plugins/storybook-config-plugin';
import { storybookOptimizeDepsPlugin } from './plugins/storybook-optimize-deps-plugin';
import { storybookProjectAnnotationsPlugin } from './plugins/storybook-project-annotations-plugin';
import { viteInjectMockerRuntime } from './plugins/vite-inject-mocker/plugin';
import { viteMockPlugin } from './plugins/vite-mock/plugin';

/**
 * Preset that provides the core Storybook Vite plugins shared between `@storybook/builder-vite` and
 * `@storybook/addon-vitest`.
 */
export async function viteCorePlugins(
  existing: PluginOption[],
  options: Options
): Promise<PluginOption[]> {
  const previewConfigPath = findConfigFile('preview', options.configDir);

  return [
    storybookProjectAnnotationsPlugin(options),
    ...storybookConfigPlugin({ configDir: options.configDir }),
    storybookOptimizeDepsPlugin(options),
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
