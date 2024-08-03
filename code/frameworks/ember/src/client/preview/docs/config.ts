import type { ArgTypesEnhancer } from 'storybook/internal/types';
import { enhanceArgTypes } from 'storybook/internal/docs-tools';

import { extractArgTypes, extractComponentDescription } from './jsondoc';

export const parameters: {} = {
  docs: {
    story: { iframeHeight: '80px' },
    extractArgTypes,
    extractComponentDescription,
  },
};

export const argTypesEnhancers: ArgTypesEnhancer[] = [enhanceArgTypes];
