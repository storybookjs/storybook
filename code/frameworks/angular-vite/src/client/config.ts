import './globals.ts';

export { render, renderToCanvas } from './render.ts';
export { decorateStory as applyDecorators } from './decorateStory.ts';

import { enhanceArgTypes } from 'storybook/internal/docs-tools';
import type { ArgTypesEnhancer, Parameters } from 'storybook/internal/types';

import { extractArgTypes, extractComponentDescription } from './compodoc.ts';

// With the docgen server on, ACM is the only engine: registering the Compodoc extractors as well
// would make Controls render the union of both, so a one-input component shows every same-named
// class's inputs too. Read at module scope because the preview's <head> assigns `FEATURES` from a
// blocking script, before any preview module evaluates.
const compodocExtraction = globalThis.FEATURES?.experimentalDocgenServer
  ? {}
  : { extractArgTypes, extractComponentDescription };

export const parameters: Parameters = {
  renderer: 'angular',
  docs: {
    story: { inline: true },
    ...compodocExtraction,
  },
};

export const argTypesEnhancers: ArgTypesEnhancer[] = [enhanceArgTypes];
