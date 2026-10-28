import {
  defineFramework,
  type RendererPlugin,
  type StorybookConfig as InstanceConfig,
} from '@storybook/core';

import { vite } from '@storybook/builder-vite/node';
import { reactViteHooks, type ReactViteOptions } from '@storybook/react-vite/node';
import { react, type ReactTypes } from '@storybook/react/node';

import type { FrameworkOptions, StorybookConfig as NextjsViteConfig } from '../types.ts';
import { getPreviewAnnotations, OPTIMIZE_VITE_DEPS, withNextjs } from '../vite-final.ts';

/** Configure Next.js Vite with native addons or preset entries. */
export type StorybookConfig = Omit<NextjsViteConfig, 'addons'> & Pick<InstanceConfig, 'addons'>;

/** Configure the Vite builder, Next.js integration, and React preview docgen. */
export interface NextjsViteOptions extends FrameworkOptions, Pick<ReactViteOptions, 'docgen'> {}

/** Compose the React renderer and the Next.js Vite integration with an isolated Vite builder. */
export const nextjsVite = defineFramework<NextjsViteOptions | void, RendererPlugin<ReactTypes>>(
  (input) => {
    const options = input || {};
    return {
      meta: { name: '@storybook/nextjs-vite' },
      builder: vite(options.builder),
      renderer: react(),
      setup(storybook): void {
        reactViteHooks(storybook, options);
        storybook.hook('core:framework:extend', () => ({
          name: '@storybook/nextjs-vite',
          options,
        }));
        storybook.hook('core:framework-options:extend', () => ({ ...options }));
        storybook.hook('preview:annotations:collect', () => getPreviewAnnotations());
        storybook.hook('builder:vite-deps:collect', () => OPTIMIZE_VITE_DEPS);
        storybook.hook('builder:vite:extend', (config) => withNextjs(config, options));
      },
    };
  }
);

export default nextjsVite;

/** Define the main configuration. */
export function defineMain<const T extends StorybookConfig>(config: T): T {
  return config;
}
