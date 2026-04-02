import { enhanceArgTypes } from 'storybook/internal/docs-tools';
import type { ArgTypesEnhancer } from 'storybook/internal/types';

import './globals.ts';
import { extractArgTypes, extractComponentDescription } from './jsondoc.ts';

export { renderToCanvas } from './render.ts';

export const parameters = {
  renderer: 'ember',
  docs: {
    story: { iframeHeight: '80px' },
    extractArgTypes,
    extractComponentDescription,
  },
};

export const argTypesEnhancers: ArgTypesEnhancer[] = [enhanceArgTypes];
