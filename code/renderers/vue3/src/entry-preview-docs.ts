import {
  type ArgTypesExtractor,
  enhanceArgTypes,
  extractComponentDescription,
} from 'storybook/internal/docs-tools';
import type { ArgTypesEnhancer } from 'storybook/internal/types';

import { extractArgTypes } from './docs/extractArgTypes';
import { sourceDecorator } from './docs/sourceDecorator';
import type { VueRenderer } from './types';

export const parameters: {
  docs: {
    story: {
      inline: boolean;
    };
    extractArgTypes: ArgTypesExtractor;
    extractComponentDescription: (component?: any) => string;
  };
} = {
  docs: {
    story: { inline: true },
    extractArgTypes,
    extractComponentDescription,
  },
};

export const decorators = [sourceDecorator];

export const argTypesEnhancers: ArgTypesEnhancer<VueRenderer>[] = [enhanceArgTypes];
