import type { Types } from 'storybook/internal/csf';
import type { InferTypes, PreviewAddon } from 'storybook/internal/csf';
import type { ProjectAnnotations } from 'storybook/internal/types';

import type { ReactPreview } from '@storybook/react';
import { __definePreview } from '@storybook/react';
import type { ReactRenderer } from '@storybook/react';

import * as nextPreview from './preview';
import type { NextJsTypes } from './types';

export * from '@storybook/react';
export * from './types';
// @ts-expect-error (double exports)
export * from './portable-stories';

export function definePreview<Addons extends PreviewAddon<never>[]>(
  preview: { addons?: Addons } & ProjectAnnotations<
    ReactRenderer & NextJsTypes & InferTypes<Addons>
  >
): NextPreview<InferTypes<Addons>> {
  // @ts-expect-error hard
  return __definePreview({
    ...preview,
    addons: [nextPreview, ...(preview.addons ?? [])],
  }) as unknown as NextPreview<InferTypes<Addons>>;
}

interface NextPreview<T extends Types> extends ReactPreview<NextJsTypes & T> {}
