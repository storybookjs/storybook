import { enhanceArgTypes, extractComponentDescription } from 'storybook/internal/docs-tools';
import type { ArgTypesEnhancer } from 'storybook/internal/types';

import { extractArgTypes } from './extractArgTypes';
import type { ReactRenderer } from './public-types';

export { render } from './render';
export { renderToCanvas } from './renderToCanvas';
export { mount } from './mount';
export { applyDecorators } from './applyDecorators';

export const parameters = {
  docs: {
    extractArgTypes,
    extractComponentDescription,
  },
};

export const argTypesEnhancers: ArgTypesEnhancer<ReactRenderer>[] = [enhanceArgTypes];
