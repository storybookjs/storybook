import {
  defineFramework,
  defineMain as coreDefineMain,
  defineRenderer,
  type RendererPlugin,
  type StorybookConfig as InstanceConfig,
} from '@storybook/core';

import { webpack } from '@storybook/builder-webpack5/node';

import type { AngularRenderer } from '../client/types.ts';
import { getPreviewAnnotations, withProdMode } from '../preview-annotations.ts';
import type { AngularCliOptions } from '../server/angular-cli-options.ts';
import { withIvyResolve } from '../server/ivy-resolve.ts';
import type { FrameworkOptions, StorybookConfig as AngularConfig } from '../types.ts';

export type { AngularRenderer } from '../client/types.ts';

/** Configure Angular with native addons or preset entries. */
export type StorybookConfig = Omit<AngularConfig, 'addons'> & Pick<InstanceConfig, 'addons'>;

/** Configure the Webpack builder and Ivy entry-point resolution. */
export type AngularFrameworkOptions = FrameworkOptions;

/** Contribute Angular's preview annotations. */
export const angularRenderer = defineRenderer<void, AngularRenderer>(() => ({
  meta: { name: '@storybook/angular' },
  setup(storybook): void {
    storybook.hook('preview:annotations:collect', async () =>
      getPreviewAnnotations(await storybook.callHook('core:docs:extend', {}))
    );
  },
}));

/** Compose Angular rendering with an isolated Webpack builder and the Angular CLI config. */
export const angular = defineFramework<
  '@storybook/angular',
  AngularFrameworkOptions | void,
  RendererPlugin<AngularRenderer>
>((input) => {
  const options = input || {};
  return {
    meta: { name: '@storybook/angular' },
    builder: webpack(options.builder),
    renderer: angularRenderer(),
    setup(storybook): void {
      storybook.hook('core:framework:extend', () => ({ name: '@storybook/angular', options }));
      storybook.hook('core:framework-options:extend', () => ({ ...options }));
      // The Angular builders pass `enableProdMode` and the other CLI options as host options.
      storybook.hook(
        'preview:annotations:collect',
        (entries, ctx) => withProdMode(entries, ctx?.enableProdMode),
        'reduce'
      );
      storybook.hook('core:typescript:extend', (config) => ({ ...config, skipCompiler: true }));
      storybook.hook('builder:webpack-config:extend', (config) => withIvyResolve(config, options));
      storybook.hook('builder:webpack:extend', async (config, ctx) => {
        const { withAngularCliConfig } = await import('../server/angular-cli-config.ts');
        return withAngularCliConfig(config, ctx as AngularCliOptions);
      });
    },
  };
});

export default angular;

/** @deprecated Import defineMain from 'storybook'. */
export const defineMain: typeof coreDefineMain = coreDefineMain;
