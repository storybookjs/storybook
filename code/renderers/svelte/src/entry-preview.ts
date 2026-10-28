import { enhanceArgTypes } from 'storybook/internal/docs-tools';
import type { ArgTypesEnhancer } from 'storybook/internal/types';

import { extractArgTypes } from './extractArgTypes.ts';
import { extractComponentDescription } from './extractComponentDescription.ts';
import type { SvelteRenderer } from './types.ts';
import { render, renderToCanvas } from './render.ts';
import { decorateStory as applyDecorators } from './decorators.ts';
import { mount } from './mount.ts';

export const parameters = {
  renderer: 'svelte',
  docs: {
    story: { inline: true },
    extractArgTypes,
    extractComponentDescription,
  },
};

export { render, renderToCanvas, applyDecorators, mount };

export const argTypesEnhancers: ArgTypesEnhancer<SvelteRenderer>[] = [enhanceArgTypes];

export default { render, renderToCanvas, applyDecorators, mount, parameters, argTypesEnhancers };
