import {
  defineFramework,
  defineMain as coreDefineMain,
  type RendererAddon,
  type StorybookConfig as InstanceConfig,
} from '@storybook/core';

import { vite } from '@storybook/builder-vite/node';
import { webComponents, type WebComponentsTypes } from '@storybook/web-components/node';

import type { FrameworkOptions, StorybookConfig as WebComponentsViteConfig } from '../types.ts';

/** Configure Web Components Vite with native addons or preset entries. */
export type StorybookConfig = Omit<WebComponentsViteConfig, 'addons'> &
  Pick<InstanceConfig, 'addons'>;

/** Compose the Web Components renderer with an isolated Vite builder. */
export const webComponentsVite = defineFramework<
  '@storybook/web-components-vite',
  FrameworkOptions | void,
  RendererAddon<WebComponentsTypes>
>((input) => {
  const options = input || {};
  return {
    meta: { name: '@storybook/web-components-vite' },
    builder: vite(options.builder),
    renderer: webComponents(),
    setup(storybook): void {
      storybook.hook('core:config:extend', (value) => ({
        ...value,
        renderer: import.meta.resolve('@storybook/web-components/node'),
      }));
      // Custom elements cannot be redefined, so story updates reload the page.
      storybook.hook('preview:hmr:extend', () => false);
      storybook.hook('core:framework:extend', () => ({
        name: '@storybook/web-components-vite',
        options,
      }));
      storybook.hook('core:framework-options:extend', () => ({ ...options }));
    },
  };
});

export default webComponentsVite;

/** @deprecated Import defineMain from 'storybook'. */
export const defineMain: typeof coreDefineMain = coreDefineMain;
