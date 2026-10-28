import { defineRenderer } from '@storybook/core';

import { getEmberPreviewAnnotation } from '../compiler.ts';

/** Contribute the Ember preview annotations. */
export const emberRenderer = defineRenderer(() => ({
  meta: { name: '@storybook/ember/renderer' },
  previewAnnotations: [getEmberPreviewAnnotation()],
  setup(): void {},
}));
