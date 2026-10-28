import { svelteCsf } from './plugins/svelte-csf.ts';
import { svelteDocgen } from './plugins/svelte-docgen.ts';
import type { StorybookConfig } from './types.ts';
import { handleSvelteKit } from './utils.ts';

type ViteConfig = Parameters<NonNullable<StorybookConfig['viteFinal']>>[0];

/** Add the Svelte docgen and CSF plugins; docgen is on unless `docgen` is `false`. */
export async function withSveltePlugins(
  config: ViteConfig,
  { frameworkName, docgen }: { frameworkName: string; docgen?: boolean }
): Promise<ViteConfig> {
  const { plugins = [] } = config;

  if (docgen !== false) {
    plugins.push(await svelteDocgen());
  }

  await handleSvelteKit(plugins, frameworkName);
  plugins.push(svelteCsf());

  return { ...config, plugins };
}
