import { enhanceArgTypes, extractComponentDescription } from 'storybook/internal/docs-tools';
import type { ArgTypesEnhancer } from 'storybook/internal/types';

import { extractArgTypes } from './extractArgTypes.ts';
import type { VueRenderer } from './types.ts';

export { render, renderToCanvas } from './render.ts';
export { decorateStory as applyDecorators } from './decorateStory.ts';
export { mount } from './mount.ts';

export const parameters = {
  renderer: 'vue3',
  docs: {
    story: { inline: true },
    extractArgTypes,
    extractComponentDescription,
  },
};

export const argTypesEnhancers: ArgTypesEnhancer<VueRenderer>[] = [enhanceArgTypes];
