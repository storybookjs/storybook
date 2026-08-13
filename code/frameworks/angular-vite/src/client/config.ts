import './globals.ts';

export { render, renderToCanvas } from './render.ts';
export { decorateStory as applyDecorators } from './decorateStory.ts';

import { enhanceArgTypes } from 'storybook/internal/docs-tools';
import type { ArgTypesEnhancer, Parameters } from 'storybook/internal/types';

import { setPropsTableMode } from '@storybook/angular-compodoc/browser';
import { extractArgTypes, extractComponentDescription } from './compodoc.ts';

// Vite's `define` never ran when a portable-stories host imports this file directly.
setPropsTableMode(
  typeof STORYBOOK_ANGULAR_OPTIONS === 'undefined'
    ? undefined
    : STORYBOOK_ANGULAR_OPTIONS.propsTable
);

export const parameters: Parameters = {
  renderer: 'angular',
  docs: {
    story: { inline: true },
    extractArgTypes,
    extractComponentDescription,
  },
};

export const argTypesEnhancers: ArgTypesEnhancer[] = [enhanceArgTypes];
