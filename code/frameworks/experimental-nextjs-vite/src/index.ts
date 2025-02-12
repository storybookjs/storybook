import type { ReactPreview } from '@storybook/react';
import { definePreview as definePreviewBase } from '@storybook/react';

import type vitePluginStorybookNextJs from 'vite-plugin-storybook-nextjs';

import * as nextPreview from './preview';

export * from './types';
export * from './portable-stories';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
declare module '@storybook/experimental-nextjs-vite/vite-plugin' {
  export const storybookNextJsPlugin: typeof vitePluginStorybookNextJs;
}

export function definePreview(preview: NextPreview['input']) {
  return definePreviewBase({
    ...preview,
    addons: [nextPreview, ...(preview.addons ?? [])],
  }) as NextPreview;
}

interface NextPreview extends ReactPreview {}
