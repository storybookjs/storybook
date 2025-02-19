import { definePreview } from 'storybook/internal/preview-api';

import * as addonAnnotations from './preview';

export * from '@storybook/blocks';
export { DocsRenderer } from './DocsRenderer';
export type { DocsParameters } from './types';

export default () => definePreview(addonAnnotations);
