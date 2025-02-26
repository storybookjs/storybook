import { definePreviewAddon } from 'storybook/internal/csf';

import * as addonAnnotations from './preview';
import type { DocsTypes } from './types';

export * from '@storybook/blocks';
export { DocsRenderer } from './DocsRenderer';
export type { DocsTypes };

export default () => definePreviewAddon<DocsTypes>(addonAnnotations);
