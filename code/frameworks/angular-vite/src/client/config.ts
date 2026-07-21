import './globals.ts';

export { render, renderToCanvas } from './render.ts';
export { decorateStory as applyDecorators } from './decorateStory.ts';

import { enhanceArgTypes } from 'storybook/internal/docs-tools';
import type { ArgTypesEnhancer, Parameters } from 'storybook/internal/types';

import { extractArgTypes, extractComponentDescription } from './compodoc.ts';

export const parameters: Parameters = {
  renderer: 'angular',
  docs: {
    story: { inline: true },
    extractArgTypes,
    extractComponentDescription,
  },
};

export const argTypesEnhancers: ArgTypesEnhancer[] = [enhanceArgTypes];
