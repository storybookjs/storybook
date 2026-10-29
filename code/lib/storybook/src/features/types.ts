import type { UnionToIntersection } from 'type-fest';
import type { StorybookTypes } from '@storybook/core/internal/types';

import type { builtInAddons } from './index.ts';

export type { ActionsTypes } from './actions/preview.ts';
export type { BackgroundsGlobals, BackgroundTypes } from './backgrounds/preview.ts';
export type { ControlsTypes } from './controls/preview.ts';
export type { HighlightTypes } from './highlight/preview.ts';
export type { MeasureTypes } from './measure/preview.ts';
export type { OutlineTypes } from './outline/preview.ts';
export type { TestTypes } from '@storybook/core/internal/deep/test/preview';
export type { ViewportGlobals, ViewportTypes } from './viewport/preview.ts';

export type CoreTypes = StorybookTypes & FeatureTypes;

/** Combine the preview-facing types declared by built-in addons. */
export type FeatureTypes = UnionToIntersection<FeatureAddonTypes<(typeof builtInAddons)[number]>>;

type FeatureAddonTypes<TAddon> = TAddon extends { readonly types?: infer TTypes }
  ? keyof TTypes extends never
    ? never
    : TTypes
  : never;

declare module '@storybook/core/internal/csf' {
  interface BuiltInTypes extends FeatureTypes {}
}
