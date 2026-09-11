import { enhanceArgTypes, extractComponentDescription } from 'storybook/internal/docs-tools';
import type { ArgTypesEnhancer } from 'storybook/internal/types';

import { extractArgTypes } from './extractArgTypes.ts';
import type { ReactRenderer } from './types.ts';

export const parameters = {
  docs: {
    extractArgTypes,
    extractComponentDescription,
  },
};

export const argTypesEnhancers: ArgTypesEnhancer<ReactRenderer>[] = [enhanceArgTypes];
