import componentTestingAnnotations from 'storybook/internal/component-testing/preview';
import type { StorybookTypes } from 'storybook/internal/types';

import actionAnnotations, { type ActionsTypes } from 'storybook/actions/preview';
import backgroundsAnnotations, { type BackgroundTypes } from 'storybook/backgrounds/preview';
import { type ControlsTypes } from 'storybook/controls/preview';
import highlightAnnotations, { type HighlightTypes } from 'storybook/highlight/preview';
import measureAnnotations, { type MeasureTypes } from 'storybook/measure/preview';
import outlineAnnotations, { type OutlineTypes } from 'storybook/outline/preview';
import testAnnotations, { type TestTypes } from 'storybook/test/preview';
import viewportAnnotations, { type ViewportTypes } from 'storybook/viewport/preview';

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
  ];
}
