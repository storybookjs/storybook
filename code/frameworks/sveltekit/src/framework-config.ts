import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { withoutVitePlugins } from '@storybook/builder-vite';

import { configOverrides } from './plugins/config-overrides.ts';
import { devPublicEnv } from './plugins/dev-public-env.ts';
import { guardServerModules } from './plugins/guard-server-modules.ts';
import { mockSveltekitModules } from './plugins/mock-sveltekit-modules.ts';
import { syncSvelteKit } from './plugins/sync.ts';
import type { StorybookConfig } from './types.ts';

type ViteConfig = Parameters<NonNullable<StorybookConfig['viteFinal']>>[0];

export const OPTIMIZE_VITE_DEPS = [
  '@storybook/sveltekit/internal/mocks/app/forms',
  '@storybook/sveltekit/internal/mocks/app/navigation',
  '@storybook/sveltekit/internal/mocks/app/state.svelte.js',
];

/**
 * SvelteKit makes its `static` directory Vite's public directory. In dev mode Vite serves it, but
 * Storybook's build only copies the public directory from the Vite config file
 */
export function sveltekitStaticDirs({
  configDir,
  production,
}: {
  configDir: string;
  production: boolean;
}): { from: string; to: string }[] {
  if (!production) {
    return [];
  }

  const assetsDir = resolve(configDir, '..', 'static');
  return existsSync(assetsDir) ? [{ from: assetsDir, to: '/' }] : [];
}

/** Swap the SvelteKit plugins that Storybook cannot run for its own, on top of the Svelte config. */
export async function withSvelteKitPlugins(baseConfig: ViteConfig): Promise<ViteConfig> {
  return {
    ...baseConfig,
    plugins: [
      // disable specific plugins that are not compatible with Storybook
      ...(await withoutVitePlugins(baseConfig.plugins ?? [], [
        'vite-plugin-sveltekit-compile',
        'vite-plugin-sveltekit-guard',
      ])),
      configOverrides(),
      syncSvelteKit(),
      devPublicEnv(),
      mockSveltekitModules(),
      guardServerModules(),
    ],
  };
}
