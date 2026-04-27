import type { StorybookTypes } from 'storybook/internal/types';

import actionAnnotations, { type ActionsTypes } from '../actions/preview.ts';
import backgroundsAnnotations, { type BackgroundTypes } from '../backgrounds/preview.ts';
import componentTestingAnnotations from '../component-testing/preview.ts';
import { type ControlsTypes } from '../controls/preview.ts';
import ghostStoriesAnnotations from '../core-server/utils/ghost-stories/test-annotations.ts';
import highlightAnnotations, { type HighlightTypes } from '../highlight/preview.ts';
import measureAnnotations, { type MeasureTypes } from '../measure/preview.ts';
import outlineAnnotations, { type OutlineTypes } from '../outline/preview.ts';
import testAnnotations, { type TestTypes } from '../test/preview.ts';
import viewportAnnotations, { type ViewportTypes } from '../viewport/preview.ts';

export type { ActionsTypes } from '../actions/preview.ts';
export type { BackgroundsGlobals, BackgroundTypes } from '../backgrounds/preview.ts';
export type { ControlsTypes } from '../controls/preview.ts';
export type { HighlightTypes } from '../highlight/preview.ts';
export type { MeasureTypes } from '../measure/preview.ts';
export type { OutlineTypes } from '../outline/preview.ts';
export type { TestTypes } from '../test/preview.ts';
export type { ViewportGlobals, ViewportTypes } from '../viewport/preview.ts';

export type CoreTypes = StorybookTypes &
  ActionsTypes &
  BackgroundTypes &
  ControlsTypes &
  HighlightTypes &
  MeasureTypes &
  OutlineTypes &
  TestTypes &
  ViewportTypes;

export function getCoreAnnotations() {
  return [
    // @ts-expect-error CJS fallback
    (measureAnnotations.default ?? measureAnnotations)(),
    // @ts-expect-error CJS fallback
    (backgroundsAnnotations.default ?? backgroundsAnnotations)(),
    // @ts-expect-error CJS fallback
    (highlightAnnotations.default ?? highlightAnnotations)(),
    // @ts-expect-error CJS fallback
    (outlineAnnotations.default ?? outlineAnnotations)(),
    // @ts-expect-error CJS fallback
    (viewportAnnotations.default ?? viewportAnnotations)(),
    // @ts-expect-error CJS fallback
    (actionAnnotations.default ?? actionAnnotations)(),
    // @ts-expect-error CJS fallback
    (componentTestingAnnotations.default ?? componentTestingAnnotations)(),
    // @ts-expect-error CJS fallback
    (testAnnotations.default ?? testAnnotations)(),
    // @ts-expect-error CJS fallback
    (ghostStoriesAnnotations.default ?? ghostStoriesAnnotations)(),
  ];
}
