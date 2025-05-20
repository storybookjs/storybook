import { enhanceArgTypes, extractComponentDescription } from 'storybook/internal/docs-tools';
import type { ArgTypesEnhancer } from 'storybook/internal/types';

import { extractArgTypes } from './extractArgTypes';
import type { VueRenderer } from './types';

export { render, renderToCanvas } from './render';
export { decorateStory as applyDecorators } from './decorateStory';
export { mount } from './mount';

export const parameters = {
  renderer: 'vue3',
  docs: {
    story: { inline: true },
    extractArgTypes,
    extractComponentDescription,
  },
};

export const argTypesEnhancers: ArgTypesEnhancer<VueRenderer>[] = [enhanceArgTypes];
