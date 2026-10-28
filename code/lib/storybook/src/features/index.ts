import type { UnionToIntersection } from 'type-fest';
import type { StorybookTypes } from '@storybook/core/internal/types';

import measure from './measure/node.ts';
import backgrounds from './backgrounds/node.ts';
import highlight from './highlight/node.ts';
import outline from './outline/node.ts';
import viewport from './viewport/node.ts';
import actions from './actions/node.ts';
import componentTesting from './component-testing/node.ts';
import test from '@storybook/core/internal/deep/test/node';
import ghostStories from '@storybook/core/internal/deep/story-index/ghost-stories/node';
import docgen from '@storybook/core/internal/deep/shared/open-service/services/docgen/node';
import storyDocs from '@storybook/core/internal/deep/shared/open-service/services/story-docs/node';
import controls from './controls/node.ts';
import review from '@storybook/manager/internal/deep/shared/open-service/services/review/node';
import toolbar from './toolbar/node.ts';

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

export const builtInAddons = [
  measure(),
  backgrounds(),
  highlight(),
  outline(),
  viewport(),
  actions(),
  componentTesting(),
  test(),
  ghostStories(),
  docgen({
    manager: '@storybook/manager/internal/deep/shared/open-service/services/docgen/manager',
  }),
  review(),
  storyDocs(),
  controls(),
  toolbar(),
] as const;
