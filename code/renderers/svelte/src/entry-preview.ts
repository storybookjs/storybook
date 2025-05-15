import { enhanceArgTypes } from 'storybook/internal/docs-tools';
import type { ArgTypesEnhancer } from 'storybook/internal/types';

import { extractArgTypes } from './extractArgTypes';
import { extractComponentDescription } from './extractComponentDescription';
import type { SvelteRenderer } from './types';

export const parameters = {
  renderer: 'svelte',
  docs: {
    story: { inline: true },
    extractArgTypes,
    extractComponentDescription,
  },
};

export { render, renderToCanvas } from './render';
export { decorateStory as applyDecorators } from './decorators';
export { mount } from './mount';

export const argTypesEnhancers: ArgTypesEnhancer<SvelteRenderer>[] = [enhanceArgTypes];
