import { enhanceArgTypes } from 'storybook/internal/docs-tools';
import type { ArgTypesEnhancer } from 'storybook/internal/types';

import { extractArgTypes } from './extractArgTypes.ts';
import { extractComponentDescription } from './extractComponentDescription.ts';
import type { SvelteRenderer } from './types.ts';

export const parameters = {
  renderer: 'svelte',
  docs: {
    story: { inline: true },
    extractArgTypes,
    extractComponentDescription,
  },
};

export { render, renderToCanvas } from './render.ts';
export { decorateStory as applyDecorators } from './decorators.ts';
export { mount } from './mount.ts';

export const argTypesEnhancers: ArgTypesEnhancer<SvelteRenderer>[] = [enhanceArgTypes];
