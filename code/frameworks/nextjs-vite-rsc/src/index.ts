import type { AddonTypes, InferTypes, PreviewAddon } from 'storybook/internal/csf';
import type { ProjectAnnotations } from 'storybook/internal/types';

import type { ReactPreview } from '@storybook/react';
import { __definePreview } from '@storybook/react';
import type { ReactTypes } from '@storybook/react';

import type vitePluginStorybookNextJs from 'vite-plugin-storybook-nextjs';

import * as nextPreview from './preview';
import type { NextJsTypes } from './types';

export * from '@storybook/react';
// @ts-expect-error (double exports)
export * from './portable-stories';
export * from './types';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
declare module '@storybook/nextjs-vite/vite-plugin' {
  export const storybookNextJsPlugin: typeof vitePluginStorybookNextJs;
}

export function definePreview<Addons extends PreviewAddon<never>[]>(
  preview: { addons?: Addons } & ProjectAnnotations<ReactTypes & NextJsTypes & InferTypes<Addons>>
): NextPreview<InferTypes<Addons>> {
  // @ts-expect-error hard
  return __definePreview({
    ...preview,
    addons: [nextPreview, ...(preview.addons ?? [])],
  });
}

interface NextPreview<T extends AddonTypes> extends ReactPreview<NextJsTypes & T> {}
