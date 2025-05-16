import { enhanceArgTypes } from 'storybook/internal/docs-tools';
import type { ArgTypesEnhancer } from 'storybook/internal/types';

import './globals';
import { extractArgTypes, extractComponentDescription } from './jsondoc';

export { renderToCanvas } from './render';

export const parameters = {
  renderer: 'ember',
  docs: {
    story: { iframeHeight: '80px' },
    extractArgTypes,
    extractComponentDescription,
  },
};

export const argTypesEnhancers: ArgTypesEnhancer[] = [enhanceArgTypes];
