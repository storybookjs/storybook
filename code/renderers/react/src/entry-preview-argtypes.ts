import { enhanceArgTypes, extractComponentDescription } from 'storybook/internal/docs-tools';
import type { ArgTypesEnhancer } from 'storybook/internal/types';

import { extractArgTypes } from './extractArgTypes';
import type { ReactRenderer } from './public-types';

export const parameters = {
  docs: {
    extractArgTypes,
    extractComponentDescription,
  },
};

export const argTypesEnhancers: ArgTypesEnhancer<ReactRenderer>[] = [enhanceArgTypes];
