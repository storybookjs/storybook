import type { InferTypes, PreviewAddon, Types } from 'storybook/internal/csf';
import type { ProjectAnnotations } from 'storybook/internal/types';

import type { ReactPreview } from '@storybook/react';
import { definePreview as definePreviewBase } from '@storybook/react';
import type { ReactRenderer } from '@storybook/react/src';

import type vitePluginStorybookNextJs from 'vite-plugin-storybook-nextjs';

import * as nextPreview from './preview';
import type { NextJsTypes } from './types';

export * from './types';
export * from './portable-stories';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
declare module '@storybook/experimental-nextjs-vite/vite-plugin' {
  export const storybookNextJsPlugin: typeof vitePluginStorybookNextJs;
}

export function definePreview<Addons extends PreviewAddon<never>[]>(
  preview: { addons?: Addons } & ProjectAnnotations<
    ReactRenderer & NextJsTypes & InferTypes<Addons>
  >
): NextPreview<InferTypes<Addons>> {
  // @ts-expect-error hard
  return definePreviewBase({
    ...preview,
    addons: [nextPreview, ...(preview.addons ?? [])],
  }) as unknown as NextPreview<InferTypes<Addons>>;
}

interface NextPreview<T extends Types> extends ReactPreview<NextJsTypes & T> {}
