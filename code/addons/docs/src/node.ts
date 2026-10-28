import './node/hooks.ts';

import { fileURLToPath } from 'node:url';

import { defineAddon } from '@storybook/core';
import type { StorybookConfigRaw } from '@storybook/core/internal/types';
import type {} from '@storybook/builder-webpack5';

import type { DocsTypes } from './types.ts';

import { manifests } from './manifest.ts';
import { resolveDocsConfig } from './node/docs-config.ts';
import type { DocsOptions } from './node/options.ts';
import { withDocsReact } from './node/resolved-react.ts';
import { registerDocsServices } from './node/services.ts';
import { extendViteConfig } from './node/vite-final.ts';
import { extendWebpackConfig } from './node/webpack.ts';

export type { DocsOptions } from './node/options.ts';

const OPTIMIZE_VITE_DEPS = [
  '@storybook/addon-docs',
  '@storybook/addon-docs/blocks',
  '@storybook/addon-docs > @mdx-js/react',
  'react-dom/client',
  'react/jsx-runtime',
  'react',
];

export default defineAddon<DocsOptions | void, DocsTypes>((input) => {
  const options = input || {};
  return {
    meta: { name: '@storybook/addon-docs' },
    manager: fileURLToPath(import.meta.resolve('@storybook/addon-docs/manager')),
    setup(storybook): void {
      storybook.hook('preview:annotations:collect', () => [
        fileURLToPath(import.meta.resolve('@storybook/addon-docs/preview')),
      ]);
      // Explicit kind: webpack projects never load builder-vite's declaration.
      storybook.hook(
        'builder:vite:extend',
        (config) => extendViteConfig(storybook, config, options),
        'reduce'
      );
      storybook.hook(
        'builder:webpack-config:extend',
        (config) => extendWebpackConfig(storybook, config, options),
        'reduce'
      );
      storybook.hook(
        'core:docs:extend',
        async (value, ctx) =>
          // Undefined on purpose: test builds that disable autodocs drop the docs config.
          resolveDocsConfig(value, {
            build: ctx?.build ?? (await storybook.callHook('core:build:extend', {})),
            defaultName: options.defaultName ?? (ctx?.defaultName as string | undefined),
            docsMode: ctx?.docs,
          }) as NonNullable<StorybookConfigRaw['docs']>
      );
      storybook.hook('legacy:resolvedReact:extend', (value) => withDocsReact(value), 'reduce');
      storybook.hook('core:services:register', () => registerDocsServices(storybook));
      storybook.hook('builder:vite-deps:collect', () => OPTIMIZE_VITE_DEPS, 'collect');
      storybook.hook('index:manifests:extend', async (value, ctx) =>
        manifests(value, {
          manifestEntries: ctx?.manifestEntries ?? [],
          features: await storybook.callHook('core:features:extend', undefined),
        })
      );
    },
  };
});
