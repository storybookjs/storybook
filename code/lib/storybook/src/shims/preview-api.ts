import { createPortableStories } from '@storybook/core/preview-api';

import { BUILT_IN_PREVIEW_ANNOTATIONS } from '../storybook/preview/built-in-annotations.ts';

export * from '@storybook/core/preview-api';

/** Portable stories with the built-in annotations composed before the renderer defaults. */
export const { setProjectAnnotations, composeStory, composeStories } = createPortableStories({
  baseAnnotations: BUILT_IN_PREVIEW_ANNOTATIONS,
});
