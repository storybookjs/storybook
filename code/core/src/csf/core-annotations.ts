import type { StorybookTypes } from 'storybook/internal/types';

import actionAnnotations, { type ActionsTypes } from '../actions/preview.ts';
import backgroundsAnnotations, { type BackgroundTypes } from '../backgrounds/preview.ts';
import componentTestingAnnotations from '../component-testing/preview.ts';
import { type ControlsTypes } from '../controls/preview.ts';
import ghostStoriesAnnotations from '../core-server/utils/ghost-stories/test-annotations.ts';
import highlightAnnotations, { type HighlightTypes } from '../highlight/preview.ts';
import measureAnnotations, { type MeasureTypes } from '../measure/preview.ts';
import outlineAnnotations, { type OutlineTypes } from '../outline/preview.ts';
import docgenAnnotations from '../shared/open-service/services/docgen/preview.ts';
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

/**
 * Marker used to flag a project-annotations object that has *already* had the core annotations
 * composed into it (e.g. the `composed` result of a CSF4 `definePreview`). Consumers that would
 * otherwise prepend {@link getCoreAnnotations} (the `StoryStore` and the portable
 * `setProjectAnnotations`) check for this marker so that core annotations are injected exactly once,
 * avoiding doubled decorators/loaders/beforeEach/beforeAll.
 *
 * We use `Symbol.for` (the global symbol registry) rather than a unique `Symbol()` so that the same
 * marker resolves across the duplicate ESM/CJS module instances that exist in dev — the annotation
 * might be flagged by one instance and read by another. A plain `Symbol()` would be a different
 * value per module instance and would not be detected. The symbol is also namespaced (no collision
 * with user annotation fields) and hidden from enumeration/JSON/string-spread.
 */
const CORE_ANNOTATIONS_COMPOSED = Symbol.for('storybook.internal.composedWithCoreAnnotations');

/** Flag a project-annotations object as already containing the core annotations. */
export function markAsComposedWithCoreAnnotations<T extends object>(annotations: T): T {
  // Keep the marker non-enumerable so it is not copied by object spread or composed configs.
  Object.defineProperty(annotations, CORE_ANNOTATIONS_COMPOSED, {
    value: true,
    enumerable: false,
    configurable: true,
    writable: true,
  });
  return annotations;
}

/** Whether a project-annotations object already contains the core annotations. */
export function hasCoreAnnotations(annotations: unknown): boolean {
  return (
    annotations != null &&
    typeof annotations === 'object' &&
    (annotations as Record<symbol, unknown>)[CORE_ANNOTATIONS_COMPOSED] === true
  );
}

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
    // @ts-expect-error CJS fallback
    (docgenAnnotations.default ?? docgenAnnotations)(),
  ];
}
