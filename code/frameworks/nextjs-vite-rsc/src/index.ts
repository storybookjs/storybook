import type { InferTypes, PreviewAddon } from 'storybook/internal/csf';
import type { ProjectAnnotations, Renderer } from 'storybook/internal/types';

import { __definePreview } from './preview.ts';
import type { NextJsRscPreview, NextJsRscTypes } from './types.ts';

export type {
  Args,
  ArgTypes,
  Decorator,
  FrameworkOptions,
  Loader,
  Meta,
  NextJsParameters,
  NextJsRequest,
  NextJsRscPreview,
  NextJsRscRenderer,
  NextJsRscStory,
  NextJsRscTypes,
  Preview,
  StorybookConfig,
  StoryContext,
  StoryFn,
  StoryObj,
} from './types.ts';
export { __definePreview } from './preview.ts';
export {
  composeStories,
  composeStory,
  INTERNAL_DEFAULT_PROJECT_ANNOTATIONS,
  setProjectAnnotations,
} from './portable-stories.ts';

/**
 * The preview of the project in CSF Next, for `.storybook/preview.ts`:
 *
 * ```ts
 * export default definePreview({ addons: [addonDocs()] });
 * ```
 *
 * A story file then imports it, for `preview.meta()` and `meta.story()`.
 */
export function definePreview<Addons extends PreviewAddon<never>[] = []>(
  input: { addons?: Addons } & ProjectAnnotations<NextJsRscTypes & InferTypes<Addons>>
): NextJsRscPreview<InferTypes<Addons>> {
  return __definePreview(
    input as { addons?: Addons } & ProjectAnnotations<Renderer>
  ) as unknown as NextJsRscPreview<InferTypes<Addons>>;
}
