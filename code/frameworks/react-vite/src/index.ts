import type { AddonTypes, InferTypes, PreviewAddonEntry } from 'storybook/internal/csf';
import type { MainConfig, MainTypes } from 'storybook/internal/instance';
import type { ProjectAnnotations } from 'storybook/internal/types';

import { __definePreview, type ReactPreview, type ReactTypes } from '@storybook/react';

export * from '@storybook/react';
export * from './types.ts';

type MainPreviewFactory<TMain extends MainConfig, TExtraTypes extends AddonTypes> = <
  Addons extends PreviewAddonEntry[] = [],
>(
  input: { addons?: Addons } & ProjectAnnotations<
    ReactTypes & MainTypes<TMain> & TExtraTypes & InferTypes<Addons> & { strictParameters: true }
  >
) => ReactPreview<MainTypes<TMain> & TExtraTypes & InferTypes<Addons> & { strictParameters: true }>;

type PreviewFactory = <Addons extends PreviewAddonEntry[] = []>(
  input: { addons?: Addons } & ProjectAnnotations<ReactTypes & InferTypes<Addons>>
) => ReactPreview<ReactTypes & InferTypes<Addons>>;

/** Infer story types from the main configuration and optional preview addons. */
export const definePreview = Object.assign(__definePreview as PreviewFactory, {
  /** Choose the main configuration while preserving preview addon inference. */
  for<TMain extends MainConfig, TExtraTypes extends AddonTypes = {}>(): MainPreviewFactory<
    TMain,
    TExtraTypes
  > {
    return __definePreview as unknown as MainPreviewFactory<TMain, TExtraTypes>;
  },
});
