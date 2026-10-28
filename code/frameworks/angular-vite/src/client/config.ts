import './globals.ts';

export { render, renderToCanvas } from './render.ts';
export { decorateStory as applyDecorators } from './decorateStory.ts';

import { enhanceArgTypes } from 'storybook/internal/docs-tools';
import type { ArgTypesEnhancer, Parameters } from 'storybook/internal/types';

import { getFeatures } from 'storybook/preview-api';

import type { Component, Directive } from './compodoc-types.ts';
import { extractArgTypes, extractComponentDescription } from './compodoc.ts';

export const parameters: Parameters = {
  renderer: 'angular',
  docs: {
    story: { inline: true },
    extractArgTypes: (component: Component | Directive) =>
      getFeatures().docgenServer === true ? {} : extractArgTypes(component),
    extractComponentDescription,
  },
};

export const argTypesEnhancers: ArgTypesEnhancer[] = [enhanceArgTypes];
