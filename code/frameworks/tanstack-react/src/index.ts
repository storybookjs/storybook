import type { AddonTypes, InferTypes, PreviewAddon } from 'storybook/internal/csf';
import type { ProjectAnnotations } from 'storybook/internal/types';

import type { ReactPreview } from '@storybook/react';
import { __definePreview } from '@storybook/react';
import type { ReactTypes } from '@storybook/react';

import * as tanstackPreview from './preview';
import type { TanStackTypes } from './types';

export * from '@storybook/react';
export * from './types';
export * from './router-helpers';

export function definePreview<Addons extends PreviewAddon<never>[]>(
  preview: {
    addons?: Addons;
  } & ProjectAnnotations<ReactTypes & TanStackTypes & InferTypes<Addons>>
): TanStackPreview<InferTypes<Addons>> {
  // @ts-expect-error passing through addons
  return __definePreview({
    ...preview,
    addons: [tanstackPreview, ...(preview.addons ?? [])],
  });
}

interface TanStackPreview<T extends AddonTypes> extends ReactPreview<TanStackTypes & T> {}
