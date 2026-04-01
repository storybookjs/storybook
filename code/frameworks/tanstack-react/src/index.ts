import type { AddonTypes, InferTypes, PreviewAddon } from 'storybook/internal/csf';
import type { ProjectAnnotations } from 'storybook/internal/types';

import type { ReactPreview } from '@storybook/react';
import { __definePreview } from '@storybook/react';
import type { ReactTypes } from '@storybook/react';

import * as tanstackPreview from './preview';
import type { TanStackTypes } from './types';
import type { StoryObj as _StoryObj } from '@storybook/react';
export * from '@storybook/react';
export * from './types';
export * from './routing/helper';
export type {
  CreateStoryRouteOptions,
  StoryRouteFileOptions,
  StoryRouteOptions,
  RouterParameters,
} from './routing/types';

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

export type StoryObj<TMetaOrCmpOrArgs = unknown> = _StoryObj<TMetaOrCmpOrArgs> &
  Partial<TanStackTypes>;

interface TanStackPreview<T extends AddonTypes> extends ReactPreview<TanStackTypes & T> {}
