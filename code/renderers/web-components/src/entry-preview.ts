import { enhanceArgTypes } from 'storybook/internal/docs-tools';
import type { ArgTypesEnhancer, DecoratorFunction } from 'storybook/internal/types';

import { extractArgTypes, extractComponentDescription } from './docs/custom-elements';
import { sourceDecorator } from './docs/sourceDecorator';
import type { WebComponentsRenderer } from './types';

export { render, renderToCanvas } from './render';

export const decorators: DecoratorFunction<WebComponentsRenderer>[] = [sourceDecorator];

export const parameters = {
  renderer: 'web-components',
  docs: {
    extractArgTypes,
    extractComponentDescription,
    story: { inline: true },
  },
};

export const argTypesEnhancers: ArgTypesEnhancer<WebComponentsRenderer>[] = [enhanceArgTypes];
