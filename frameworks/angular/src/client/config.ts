import './globals';

export { render, renderToCanvas } from './render';
export { decorateStory as applyDecorators } from './decorateStory';

import { enhanceArgTypes } from 'storybook/internal/docs-tools';
import type { ArgTypesEnhancer, Parameters } from 'storybook/internal/types';

import { extractArgTypes, extractComponentDescription } from './compodoc';

export const parameters: Parameters = {
  renderer: 'angular',
  docs: {
    story: { inline: true },
    extractArgTypes,
    extractComponentDescription,
  },
};

export const argTypesEnhancers: ArgTypesEnhancer[] = [enhanceArgTypes];
