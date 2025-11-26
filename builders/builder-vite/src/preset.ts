import { findConfigFile } from 'storybook/internal/common';
import type { Options } from 'storybook/internal/types';

import type { UserConfig } from 'vite';

import { viteInjectMockerRuntime } from './plugins/vite-inject-mocker/plugin';
import { viteMockPlugin } from './plugins/vite-mock/plugin';

// This preset defines currently mocking plugins for Vite
// It is defined as a viteFinal preset so that @storybook/addon-vitest can use it as well and that it doesn't have to be duplicated in addon-vitest.
// The main vite configuration is defined in `./vite-config.ts`.
export async function viteFinal(existing: UserConfig, options: Options) {
  const previewConfigPath = findConfigFile('preview', options.configDir);

  // If there's no preview file, there's nothing to mock.
  if (!previewConfigPath) {
    return existing;
  }

  const coreOptions = await options.presets.apply('core');

  return {
    ...existing,
    plugins: [
      ...(existing.plugins ?? []),
      ...(previewConfigPath
        ? [
            viteInjectMockerRuntime({ previewConfigPath }),
            viteMockPlugin({ previewConfigPath, coreOptions, configDir: options.configDir }),
          ]
        : []),
    ],
  };
}
