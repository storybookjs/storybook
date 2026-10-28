import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { StorybookConfigVite } from '@storybook/builder-vite';

import semver from 'semver';
import vitePluginStorybookNextjs from 'vite-plugin-storybook-nextjs';

import { normalizePostCssConfig } from './find-postcss-config.ts';
import type { FrameworkOptions } from './types.ts';
import { getNextjsVersion } from './utils.ts';

export const OPTIMIZE_VITE_DEPS = [
  '@storybook/nextjs-vite/link.mock',
  '@storybook/nextjs-vite/navigation.mock',
  '@storybook/nextjs-vite/router.mock',
  '@storybook/nextjs-vite > styled-jsx',
  '@storybook/nextjs-vite > styled-jsx/style',
  '@opentelemetry/api',
];

type ViteConfig = Parameters<NonNullable<StorybookConfigVite['viteFinal']>>[0];

/** List the preview annotation files this framework adds after the renderer's. */
export function getPreviewAnnotations(): string[] {
  const annotations = [fileURLToPath(import.meta.resolve('@storybook/nextjs-vite/preview'))];

  // TODO: Remove this once we only support Next.js v16 and above
  if (!semver.gte(getNextjsVersion(), '16.0.0')) {
    annotations.push(fileURLToPath(import.meta.resolve('@storybook/nextjs-vite/config/preview')));
  }

  return annotations;
}

/** Add the Next.js aliases and Vite plugin to a config that already has the React plugins. */
export async function withNextjs(
  config: ViteConfig,
  { nextConfigPath, image = {} }: Pick<FrameworkOptions, 'nextConfigPath' | 'image'>
): Promise<ViteConfig> {
  const inlineOptions = config.css?.postcss;
  const searchPath = typeof inlineOptions === 'string' ? inlineOptions : config.root;

  if (searchPath) {
    await normalizePostCssConfig(searchPath);
  }

  const vitePluginOptions = {
    image,
    dir: nextConfigPath ? dirname(nextConfigPath) : undefined,
  };

  return {
    ...config,
    resolve: {
      ...(config?.resolve ?? {}),
      alias: {
        ...(config?.resolve?.alias ?? {}),
        'styled-jsx': dirname(fileURLToPath(import.meta.resolve('styled-jsx/package.json'))),
        'styled-jsx/style': fileURLToPath(import.meta.resolve('styled-jsx/style')),
        'styled-jsx/style.js': fileURLToPath(import.meta.resolve('styled-jsx/style')),
      },
    },
    plugins: [...(config?.plugins ?? []), vitePluginStorybookNextjs(vitePluginOptions)],
  };
}
