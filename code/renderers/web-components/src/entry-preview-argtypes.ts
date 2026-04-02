import { enhanceArgTypes } from 'storybook/internal/docs-tools';
import type { ArgTypesEnhancer } from 'storybook/internal/types';

import { extractArgTypes, extractComponentDescription } from './docs/custom-elements.ts';
import type { WebComponentsRenderer } from './types.ts';

export const parameters = {
  docs: {
    extractArgTypes,
    extractComponentDescription,
  },
};

export const argTypesEnhancers: ArgTypesEnhancer<WebComponentsRenderer>[] = [enhanceArgTypes];
