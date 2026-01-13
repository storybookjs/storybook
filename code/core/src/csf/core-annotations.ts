import type { StorybookTypes } from 'storybook/internal/types';

import actionAnnotations, { type ActionsTypes } from '../actions/preview';
import backgroundsAnnotations, { type BackgroundTypes } from '../backgrounds/preview';
import componentTestingAnnotations from '../component-testing/preview';
import { type ControlsTypes } from '../controls/preview';
import ghostStoriesAnnotations from '../core-server/utils/ghost-stories/test-annotations';
import highlightAnnotations, { type HighlightTypes } from '../highlight/preview';
import measureAnnotations, { type MeasureTypes } from '../measure/preview';
import outlineAnnotations, { type OutlineTypes } from '../outline/preview';
import testAnnotations, { type TestTypes } from '../test/preview';
import viewportAnnotations, { type ViewportTypes } from '../viewport/preview';

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
