import type { ArgTypesEnhancer, DecoratorFunction } from 'storybook/internal/types';
import type { ArgTypesExtractor } from 'storybook/internal/docs-tools';
import { extractComponentDescription, enhanceArgTypes } from 'storybook/internal/docs-tools';
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

export const decorators: DecoratorFunction<VueRenderer>[] = [sourceDecorator];

export const argTypesEnhancers: ArgTypesEnhancer<VueRenderer>[] = [enhanceArgTypes];
