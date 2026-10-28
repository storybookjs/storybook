import {
  defineFramework,
  defineMain as coreDefineMain,
  type RendererPlugin,
  type StorybookConfig as InstanceConfig,
} from '@storybook/core';

import { vite } from '@storybook/builder-vite/node';
import { reactViteHooks } from '@storybook/react-vite/node';
import { react, type ReactTypes } from '@storybook/react/node';

import type { NextjsViteOptions, StorybookConfig as NextjsViteConfig } from '../types.ts';
import { getPreviewAnnotations, OPTIMIZE_VITE_DEPS, withNextjs } from '../vite-final.ts';

export type { NextjsViteOptions };

/** Configure Next.js Vite with native addons or preset entries. */
export type StorybookConfig = Omit<NextjsViteConfig, 'addons'> & Pick<InstanceConfig, 'addons'>;

/** Compose the React renderer and the Next.js Vite integration with an isolated Vite builder. */
export const nextjsVite = defineFramework<
  '@storybook/nextjs-vite',
  NextjsViteOptions | void,
  RendererPlugin<ReactTypes>
>((input) => {
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
});

export default nextjsVite;

/** @deprecated Import defineMain from 'storybook'. */
export const defineMain: typeof coreDefineMain = coreDefineMain;
