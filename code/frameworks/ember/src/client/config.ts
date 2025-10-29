import { enhanceArgTypes } from 'storybook/internal/docs-tools';
import type { ArgTypesEnhancer, Parameters } from 'storybook/internal/types';

export { renderToCanvas, render } from './render';

export const parameters: Parameters = {
  renderer: 'ember',
  docs: {
    story: { inline: true },
  },
};

export const argTypesEnhancers: ArgTypesEnhancer[] = [enhanceArgTypes];
