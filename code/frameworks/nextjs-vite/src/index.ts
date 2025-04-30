import type { ProjectAnnotations } from 'storybook/internal/types';

import type { ReactPreview } from '@storybook/react';
import { __definePreview } from '@storybook/react';
import type { ReactRenderer } from '@storybook/react';

import type vitePluginStorybookNextJs from 'vite-plugin-storybook-nextjs';

import * as nextPreview from './preview';

export * from '@storybook/react';
// @ts-expect-error (double exports)
export * from './portable-stories';
export * from './types';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
declare module '@storybook/nextjs-vite/vite-plugin' {
  export const storybookNextJsPlugin: typeof vitePluginStorybookNextJs;
}

export function definePreview(preview: NextPreview['input']) {
  return __definePreview({
    ...preview,
    addons: [
      nextPreview as unknown as ProjectAnnotations<ReactRenderer>,
      ...(preview.addons ?? []),
    ],
  }) as NextPreview;
}

interface NextPreview extends ReactPreview {}
