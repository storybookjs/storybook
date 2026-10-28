import { fileURLToPath } from 'node:url';

import {
  defineFramework,
  type RendererPlugin,
  type StorybookConfig as InstanceConfig,
} from '@storybook/core';

import { webpack } from '@storybook/builder-webpack5/node';
import { presetReactWebpack } from '@storybook/preset-react-webpack/node';
import { react, type ReactTypes } from '@storybook/react/node';

import type { TransformOptions } from '@babel/core';
import type webpackModule from 'webpack';

import {
  configureNextBabel,
  configureNextWebpack,
  getNextPreviewAnnotations,
} from '../framework-config.ts';
import type { FrameworkOptions, StorybookConfig as NextjsConfig } from '../types.ts';
import { resolveNextConfig } from '../utils.ts';

/** Configure Next.js with native addons or preset entries. */
export type StorybookConfig = Omit<NextjsConfig, 'addons'> & Pick<InstanceConfig, 'addons'>;

/** Compose the React renderer, the Webpack builder, and the Next.js configuration. */
export const nextjs = defineFramework<FrameworkOptions | void, RendererPlugin<ReactTypes>>(
  (input) => {
    const options = input || {};
    return {
      meta: { name: '@storybook/nextjs' },
      builder: webpack(options.builder),
      renderer: react(),
      addons: [presetReactWebpack()],
      async setup(storybook): Promise<void> {
        // Next.js patches Webpack internals while loading its config, before the builder starts.
        await resolveNextConfig({ nextConfigPath: options.nextConfigPath });
        // The legacy preset copies the framework's builder options into `core`.
        storybook.hook('core:config:extend', (value) => ({
          ...value,
          builder: {
            name: import.meta.resolve('@storybook/builder-webpack5'),
            options: { ...options.builder },
          },
          renderer: fileURLToPath(import.meta.resolve('@storybook/react/node')),
        }));
        storybook.hook('core:framework:extend', () => ({ name: '@storybook/nextjs', options }));
        storybook.hook('core:framework-options:extend', () => ({ ...options }));
        storybook.hook('preview:annotations:collect', () => getNextPreviewAnnotations());
        storybook.hook(
          'builder:babel:extend',
          async (config) =>
            (await configureNextBabel((config ?? {}) as TransformOptions)) as Record<
              string,
              unknown
            >
        );
        storybook.hook('builder:webpack:extend', async (config, ctx) =>
          configureNextWebpack(config, {
            nextConfigPath: options.nextConfigPath,
            webpackInstance: ctx?.webpackInstance as typeof webpackModule,
            configType: ctx?.configType,
            configDir: storybook.configDir,
            features: storybook.options.features,
            getBabelOptions: () => storybook.callHook('builder:babel:extend', {}, ctx),
            getTypescriptOptions: () => storybook.callHook('core:typescript:extend', {}, ctx),
          })
        );
      },
    };
  }
);

export default nextjs;

/** Define the main configuration. */
export function defineMain<const T extends StorybookConfig>(config: T): T {
  return config;
}
