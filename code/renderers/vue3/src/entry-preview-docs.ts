import { enhanceArgTypes, extractComponentDescription } from '@storybook/docs-tools';
import type { ArgTypesEnhancer } from '@storybook/types';
import { extractArgTypes } from './docs/extractArgTypes';
import { sourceDecorator } from './docs/sourceDecorator';
import type { VueRenderer } from './types';

export const parameters = {
  docs: {
    story: { inline: true },
    extractArgTypes,
    extractComponentDescription,
  },
};

export const decorators = [sourceDecorator];

export const argTypesEnhancers: ArgTypesEnhancer<VueRenderer>[] = [enhanceArgTypes];
