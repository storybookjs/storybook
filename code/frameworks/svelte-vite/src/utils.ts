import { SvelteViteWithSvelteKitError } from '@storybook/core/internal/server-errors';

import { hasVitePlugins } from '@storybook/builder-vite';

import type { PluginOption } from 'vite';

/**
 * A migration step that ensures the svelte-vite framework still supports SvelteKit, but warns the
 * user that they should use the sveltekit framework instead. Should be removed when we decide to
 * remove support completely for SvelteKit in svelte-vite
 */
export async function handleSvelteKit(
  plugins: PluginOption[],
  frameworkName: string
): Promise<void> {
  /*
  the sveltekit framework uses this svelte-vite framework under the hood
  so we have to take extra care of only throwing when the user is actually using
  svelte-vite directly and not just through sveltekit
  */
  const hasSvelteKitPlugins = await hasVitePlugins(plugins, [
    'vite-plugin-sveltekit-setup',
    'vite-plugin-sveltekit-compile',
  ]);

  if (hasSvelteKitPlugins && !frameworkName.includes('@storybook/sveltekit')) {
    throw new SvelteViteWithSvelteKitError();
  }
}
