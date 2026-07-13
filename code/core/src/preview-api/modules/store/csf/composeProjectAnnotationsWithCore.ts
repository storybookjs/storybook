import {
  getCoreAnnotations,
  hasCoreAnnotations,
  markAsComposedWithCoreAnnotations,
} from 'storybook/internal/csf';
import type {
  ModuleExports,
  NormalizedProjectAnnotations,
  Renderer,
} from 'storybook/internal/types';

import { composeConfigs } from './composeConfigs.ts';

/**
 * Composes project annotations together, prepending Storybook's core annotations unless they are
 * already present, and flags the result via {@link markAsComposedWithCoreAnnotations} so later
 * composition does not add them a second time.
 *
 * Core annotations carry behavior that must be applied exactly once per realm: decorators, loaders,
 * `beforeEach`, and the `beforeAll` hooks that register the built-in open services (`core/docgen`,
 * `core/story-docs`). CSF4 previews (`definePreview`) already fold the core annotations into their
 * `composed` result and mark it; plain CSF1-3 previews do not. Every entrypoint that runs `beforeAll`
 * or builds the story store off the raw project annotations (the browser preview, the store, and
 * portable stories) funnels them through here so the behavior is identical across all of them.
 *
 * Pass the *raw* annotation modules (not pre-composed) so the CSF4 marker survives the
 * `hasCoreAnnotations` check. The result is composed but NOT normalized — callers that need a
 * {@link NormalizedProjectAnnotations} should run `normalizeProjectAnnotations` on top.
 */
export function composeProjectAnnotationsWithCore<TRenderer extends Renderer = Renderer>(
  annotations: ModuleExports[]
): NormalizedProjectAnnotations<TRenderer> {
  // Drop falsy entries (e.g. `setProjectAnnotations(undefined)` or a sparse array): `composeConfigs`
  // reads `.default` off each entry and would throw on `null`/`undefined`.
  const definedAnnotations = annotations.filter(Boolean);
  const alreadyComposedWithCore = definedAnnotations.some((annotation) =>
    hasCoreAnnotations(annotation)
  );
  return markAsComposedWithCoreAnnotations(
    composeConfigs<TRenderer>(
      alreadyComposedWithCore
        ? definedAnnotations
        : [...getCoreAnnotations(), ...definedAnnotations]
    )
  );
}
