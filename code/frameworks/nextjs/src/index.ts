import type { AddonTypes, InferTypes, PreviewAddon } from 'storybook/internal/csf';
import type { ProjectAnnotations } from 'storybook/internal/types';

import type { ReactPreview } from '@storybook/react';
import { __definePreview } from '@storybook/react';
import type { ReactTypes } from '@storybook/react';

import * as nextPreview from './preview';
import type { NextJsTypes } from './types';

export * from '@storybook/react';
export * from './types';
// @ts-expect-error (double exports)
export * from './portable-stories';

export function definePreview<Addons extends PreviewAddon<never>[]>(
  preview: { addons?: Addons } & ProjectAnnotations<ReactTypes & NextJsTypes & InferTypes<Addons>>
): NextPreview<InferTypes<Addons>> {
  // @ts-expect-error hard
  return __definePreview({
    ...preview,
    addons: [nextPreview, ...(preview.addons ?? [])],
  });
}

export interface NextPreview<T extends AddonTypes> extends ReactPreview<NextJsTypes & T> {}
