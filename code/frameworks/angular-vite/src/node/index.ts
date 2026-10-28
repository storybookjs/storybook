import {
  defineFramework,
  defineRenderer,
  type RendererPlugin,
  type StorybookConfig as InstanceConfig,
} from '@storybook/core';
import type { Options } from '@storybook/core/internal/types';

import type { UserConfig } from 'vite';

import { vite } from '@storybook/builder-vite/node';

import type { AngularRenderer } from '../client/types.ts';
import { getDocgenProvider, withComponentsManifest } from '../docgen/docgen-provider.ts';
import { angularStoryDocsProvider } from '../docgen/story-docs-provider.ts';
import { getPreviewAnnotations, withProdMode } from '../preview-annotations.ts';
import type { FrameworkOptions, StorybookConfig as AngularViteConfig } from '../types.ts';
import { withAngularVite, type AngularViteHostOptions } from '../vite-config.ts';

export type { AngularRenderer } from '../client/types.ts';

/** Configure Angular Vite with native addons or preset entries. */
export type StorybookConfig = Omit<AngularViteConfig, 'addons'> & Pick<InstanceConfig, 'addons'>;

/** Configure the Vite builder, the Angular compiler plugin, Compodoc, and the props table. */
export type AngularViteOptions = FrameworkOptions;

/** Contribute Angular's preview annotations and server docgen. */
export const angularViteRenderer = defineRenderer<void, AngularRenderer>(() => ({
  meta: { name: '@storybook/angular-vite' },
  setup(storybook): void {
    storybook.hook('preview:annotations:collect', async () =>
      getPreviewAnnotations(await storybook.callHook('core:docs:extend', {}))
    );
    storybook.hook('core:features:extend', (value) => ({ ...value, componentsManifest: true }));
    storybook.hook('core:docgen-enabled:extend', () => true);
    storybook.hook('core:docgen-providers:collect', async () => [
      getDocgenProvider(
        await storybook.callHook('core:framework-options:extend', undefined),
        await storybook.callHook('core:features:extend', {})
      ),
    ]);
    storybook.hook('index:manifests:extend', (value) =>
      withComponentsManifest(value ?? {}, storybook.options.features)
    );
    storybook.hook('core:story-docs-provider:extend', (value, ctx) =>
      angularStoryDocsProvider(value ?? (async () => undefined), ctx as Options)
    );
  },
}));

/** Compose Angular rendering with an isolated Vite builder and the Analog Angular plugin. */
export const angularVite = defineFramework<
  AngularViteOptions | void,
  RendererPlugin<AngularRenderer>
>((input) => {
  const options = input || {};
  return {
    meta: { name: '@storybook/angular-vite' },
    builder: vite(options.builder),
    renderer: angularViteRenderer(),
    setup(storybook): void {
      storybook.hook('core:framework:extend', () => ({ name: '@storybook/angular-vite', options }));
      // The legacy preset copies the framework's builder options into `core`.
      storybook.hook('core:config:extend', (core) => ({
        ...core,
        builder: {
          name: import.meta.resolve('@storybook/builder-vite'),
          options: options.builder ?? {},
        },
      }));
      storybook.hook('core:framework-options:extend', () => ({ ...options }));
      // The Angular builders pass `enableProdMode` and the other CLI options as host options.
      storybook.hook(
        'preview:annotations:collect',
        (entries, ctx) => withProdMode(entries, ctx?.enableProdMode),
        'reduce'
      );
      storybook.hook('core:typescript:extend', (config) => ({ ...config, skipCompiler: true }));
      // This package compiles against Vite 8 while the hook declares builder-vite's Vite types.
      storybook.hook(
        'builder:vite:extend',
        async (config, ctx) =>
          (await withAngularVite(
            config as unknown as UserConfig,
            ctx as unknown as AngularViteHostOptions,
            { frameworkOptions: options, features: storybook.options.features }
          )) as unknown as typeof config
      );
    },
  };
});

export default angularVite;

/** Define the main configuration. */
export function defineMain<const T extends StorybookConfig>(config: T): T {
  return config;
}
