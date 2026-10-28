import type { StorybookTypes } from '@storybook/core/internal/types';

import type { ProjectAnnotations } from './story.ts';

/** Register the types contributed by built-in feature annotations. */
export interface BuiltInTypes {}

export type CoreTypes = StorybookTypes & BuiltInTypes;

const CORE_ANNOTATIONS_COMPOSED = Symbol.for('storybook.internal.composedWithCoreAnnotations');

type CoreAnnotationsRegistry = Record<symbol, (() => ProjectAnnotations[]) | undefined>;

/**
 * Kept on `globalThis` so duplicate module instances (source and bundled copies) share one
 * registry. The key is built per call because the composite registers during a circular import,
 * before this module's top-level constants are initialized.
 */
export function setCoreAnnotations(factory: () => ProjectAnnotations[]): void {
  (globalThis as CoreAnnotationsRegistry)[Symbol.for('storybook.internal.coreAnnotationsFactory')] =
    factory;
}

export function getCoreAnnotations(): ProjectAnnotations[] {
  return (
    (globalThis as CoreAnnotationsRegistry)[
      Symbol.for('storybook.internal.coreAnnotationsFactory')
    ]?.() ?? []
  );
}

/** Flag a project-annotations object as already containing the core annotations. */
export function markAsComposedWithCoreAnnotations<T extends object>(annotations: T): T {
  Object.defineProperty(annotations, CORE_ANNOTATIONS_COMPOSED, {
    value: true,
    enumerable: false,
    configurable: true,
    writable: true,
  });
  return annotations;
}

/** Check whether project annotations already contain the core annotations. */
export function hasCoreAnnotations(annotations: unknown): boolean {
  return (
    annotations != null &&
    typeof annotations === 'object' &&
    (annotations as Record<symbol, unknown>)[CORE_ANNOTATIONS_COMPOSED] === true
  );
}
