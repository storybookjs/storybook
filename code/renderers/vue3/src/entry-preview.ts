import { enhanceArgTypes, extractComponentDescription } from 'storybook/internal/docs-tools';
import type { ArgTypesEnhancer } from 'storybook/internal/types';

import { extractArgTypes } from './docgen/component-docgen/arg-types/extractArgTypes.ts';
import type { VueRenderer } from './types.ts';

import { render, renderToCanvas } from './render.ts';
import { decorateStory as applyDecorators } from './decorateStory.ts';
import { mount } from './mount.ts';

export { render, renderToCanvas, applyDecorators, mount };

export const parameters = {
  renderer: 'vue3',
  docs: {
    story: { inline: true },
    extractArgTypes,
    extractComponentDescription,
  },
};

export const argTypesEnhancers: ArgTypesEnhancer<VueRenderer>[] = [enhanceArgTypes];

export default { render, renderToCanvas, applyDecorators, mount, parameters, argTypesEnhancers };
