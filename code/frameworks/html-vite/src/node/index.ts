import {
  defineFramework,
  defineMain as coreDefineMain,
  type RendererPlugin,
  type StorybookConfig as InstanceConfig,
} from '@storybook/core';

import { vite } from '@storybook/builder-vite/node';
import { html } from '@storybook/html/node';
import type { HtmlRenderer } from '@storybook/html/node';

import type { FrameworkOptions, StorybookConfig as HtmlViteConfig } from '../types.ts';

/** Configure HTML Vite with native addons or preset entries. */
export type StorybookConfig = Omit<HtmlViteConfig, 'addons'> & Pick<InstanceConfig, 'addons'>;

/** Configure the Vite builder. */
export type HtmlViteOptions = FrameworkOptions;

/** Compose the HTML renderer with an isolated Vite builder. */
export const htmlVite = defineFramework<
  '@storybook/html-vite',
  HtmlViteOptions | void,
  RendererPlugin<HtmlRenderer>
>((input) => {
  const options = input || {};
  return {
    meta: { name: '@storybook/html-vite' },
    builder: vite(options.builder),
    renderer: html(),
    setup(storybook): void {
      storybook.hook('core:config:extend', (value) => ({
        ...value,
        renderer: import.meta.resolve('@storybook/html/node'),
      }));
      storybook.hook('core:framework:extend', () => ({
        name: '@storybook/html-vite',
        options,
      }));
      storybook.hook('core:framework-options:extend', () => ({ ...options }));
    },
  };
});

export default htmlVite;

/** @deprecated Import defineMain from 'storybook'. */
export const defineMain: typeof coreDefineMain = coreDefineMain;
