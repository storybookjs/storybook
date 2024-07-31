import type { ArgTypesEnhancer, DecoratorFunction } from 'storybook/internal/types';
import type { ArgTypesExtractor } from 'storybook/internal/docs-tools';
import { enhanceArgTypes } from 'storybook/internal/docs-tools';
import { extractArgTypes } from './docs/extractArgTypes';
import { extractComponentDescription } from './docs/extractComponentDescription';
import { sourceDecorator } from './docs/sourceDecorator';
import type { SvelteRenderer } from './types';

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

export const decorators: DecoratorFunction<SvelteRenderer>[] = [sourceDecorator];

export const argTypesEnhancers: ArgTypesEnhancer<SvelteRenderer>[] = [enhanceArgTypes];
