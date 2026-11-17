import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { PresetProperty, PresetPropertyFn } from 'storybook/internal/types';

import { withoutVitePlugins } from '@storybook/builder-vite';
import { viteFinal as svelteViteFinal } from '@storybook/svelte-vite/preset';

import type { PluginOption } from 'vite';

import { configOverrides } from './plugins/config-overrides.ts';
import { devPublicEnv } from './plugins/dev-public-env.ts';
import { guardServerModules } from './plugins/guard-server-modules.ts';
import { mockSveltekitModules } from './plugins/mock-sveltekit-modules.ts';
import { syncSvelteKit } from './plugins/sync.ts';
import { type StorybookConfig } from './types.ts';

export const core: PresetProperty<'core'> = {
  builder: import.meta.resolve('@storybook/builder-vite'),
  renderer: import.meta.resolve('@storybook/svelte/preset'),
};
export const previewAnnotations: PresetProperty<'previewAnnotations'> = (entry = []) => [
  ...entry,
  fileURLToPath(import.meta.resolve('@storybook/sveltekit/preview')),
];

// SvelteKit makes its `static` directory Vite's public directory. In dev mode Vite serves it, but
// Storybook's build only copies the public directory from the Vite config file
export const staticDirs: PresetPropertyFn<'staticDirs'> = async (values = [], options) => {
  if (options.configType !== 'PRODUCTION') {
    return values;
  }

  const assetsDir = resolve(options.configDir, '..', 'static');
  return existsSync(assetsDir) ? [...values, { from: assetsDir, to: '/' }] : values;
};

function withoutKitSsrMiddleware(plugin: PluginOption): PluginOption {
  if (Array.isArray(plugin)) {
    return plugin.map(withoutKitSsrMiddleware);
  }
  if (
    !plugin ||
    !('name' in plugin) ||
    plugin.name !== 'vite-plugin-sveltekit-setup' ||
    !plugin.configureServer
  ) {
    return plugin;
  }

  const hook =
    typeof plugin.configureServer === 'function'
      ? { handler: plugin.configureServer }
      : plugin.configureServer;
  return {
    ...plugin,
    configureServer: {
      ...hook,
      async handler(server) {
        // Kit sets up its files and watchers here. Its returned hook installs the app's SSR handler.
        await hook.handler.call(this, server);
      },
    },
  };
}

export const viteFinal: NonNullable<StorybookConfig['viteFinal']> = async (config, options) => {
  const baseConfig = await svelteViteFinal(config, options);
  const plugins = await withoutVitePlugins(baseConfig.plugins ?? [], [
    'vite-plugin-sveltekit-compile',
    'vite-plugin-sveltekit-guard',
  ]);

  return {
    ...baseConfig,
    plugins: [
      ...plugins.map(withoutKitSsrMiddleware),
      configOverrides(),
      syncSvelteKit(),
      devPublicEnv(),
      mockSveltekitModules(),
      guardServerModules(),
    ],
  };
};

export const optimizeViteDeps = [
  '@storybook/sveltekit/forms.mock',
  '@storybook/sveltekit/internal/mocks/app/state.svelte.js',
  '@storybook/sveltekit/internal/mocks/docs-isolation',
  '@storybook/sveltekit/navigation.mock',
];
