import { enhanceArgTypes } from 'storybook/internal/docs-tools';
import type { ArgTypesEnhancer } from 'storybook/internal/types';

import { extractArgTypes, extractComponentDescription } from './jsondoc';

export const parameters: {} = {
  docs: {
    story: { iframeHeight: '80px' },
    extractArgTypes,
    extractComponentDescription,
  },
};

export const argTypesEnhancers: ArgTypesEnhancer[] = [enhanceArgTypes];
