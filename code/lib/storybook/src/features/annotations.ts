import type { ProjectAnnotations } from 'storybook/internal/csf';

import measure from './measure/preview.ts';
import backgrounds from './backgrounds/preview.ts';
import highlight from './highlight/preview.ts';
import outline from './outline/preview.ts';
import viewport from './viewport/preview.ts';
import actions from './actions/preview.ts';
import componentTesting from './component-testing/preview.ts';
import test from '@storybook/core/internal/deep/test/preview';
import ghostStories from '@storybook/core/internal/deep/story-index/ghost-stories/test-annotations';
import docgen from '@storybook/core/internal/deep/shared/open-service/services/docgen/preview';
import storyDocs from '@storybook/core/internal/deep/shared/open-service/services/story-docs/preview';

export {
  hasCoreAnnotations,
  markAsComposedWithCoreAnnotations,
} from '@storybook/core/internal/csf';

const CORE_ANNOTATION_FACTORIES = [
  measure,
  backgrounds,
  highlight,
  outline,
  viewport,
  actions,
  componentTesting,
  test,
  ghostStories,
  docgen,
  storyDocs,
];

/**
 * Create the built-in addons' preview annotations in registration order.
 *
 * Kept apart from the built-in addon plugins so the server never loads the preview runtime.
 */
export function getCoreAnnotations(): ProjectAnnotations[] {
  return CORE_ANNOTATION_FACTORIES.map((factory) =>
    // CJS fallback
    ((factory as unknown as { default?: typeof factory }).default ?? factory)()
  );
}
