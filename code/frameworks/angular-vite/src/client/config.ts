import './globals.ts';

export { render, renderToCanvas } from './render.ts';
export { decorateStory as applyDecorators } from './decorateStory.ts';

import { enhanceArgTypes } from 'storybook/internal/docs-tools';
import type { ArgTypesEnhancer, Parameters } from 'storybook/internal/types';

import { global } from '@storybook/global';

import type { Component, Directive } from './compodoc-types.ts';
import { extractArgTypes, extractComponentDescription } from './compodoc.ts';

export const parameters: Parameters = {
  renderer: 'angular',
  docs: {
    story: { inline: true },
    // Under the docgen server the worker payload owns extraction and the UI unions
    // `customArgTypes` back on top of it (`mergeServiceArgTypes`), so a Compodoc extraction here
    // would resurrect every member `propsTable` filtered out of the payload. Contributing nothing
    // keeps `customArgTypes` annotation-only, like the other Vite frameworks whose docgen
    // injection is starved under the flag. The parameter stays defined because the docs blocks
    // read a missing `extractArgTypes` as "args unsupported" and error instead of rendering.
    extractArgTypes: (component: Component | Directive) =>
      global.FEATURES?.experimentalDocgenServer === true ? {} : extractArgTypes(component),
    extractComponentDescription,
  },
};

export const argTypesEnhancers: ArgTypesEnhancer[] = [enhanceArgTypes];
