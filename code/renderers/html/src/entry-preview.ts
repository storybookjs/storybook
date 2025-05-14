import { enhanceArgTypes } from 'storybook/internal/docs-tools';
import type { ArgTypesEnhancer } from 'storybook/internal/types';

import type { Parameters } from './types';

export const parameters: Parameters = { renderer: 'html' };

export { renderToCanvas, render } from './render';

export const argTypesEnhancers: ArgTypesEnhancer[] = [enhanceArgTypes];
