import type { PreviewAddonEntry } from '@storybook/core/internal/csf';
import ghostStories from '@storybook/core/internal/deep/story-index/ghost-stories/test-annotations';
import docgen from '@storybook/core/internal/deep/shared/open-service/services/docgen/preview';
import storyDocs from '@storybook/core/internal/deep/shared/open-service/services/story-docs/preview';
import test from '@storybook/core/internal/deep/test/preview';

import actions from '../../features/actions/preview.ts';
import backgrounds from '../../features/backgrounds/preview.ts';
import componentTesting from '../../features/component-testing/preview.ts';
import highlight from '../../features/highlight/preview.ts';
import measure from '../../features/measure/preview.ts';
import outline from '../../features/outline/preview.ts';
import viewport from '../../features/viewport/preview.ts';

/**
 * The preview annotations of every default built-in addon, in `builtInAddons` order. Portable
 * stories and CSF factories apply them when no Storybook host composes the collected annotations.
 */
export const BUILT_IN_PREVIEW_ANNOTATIONS: PreviewAddonEntry[] = [
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
