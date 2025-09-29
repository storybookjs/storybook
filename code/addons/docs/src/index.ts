import { definePreviewAddon } from 'storybook/internal/csf';

import * as addonAnnotations from './preview';
import type { DocsTypes } from './types';

export { DocsRenderer } from './DocsRenderer';
export type { DocsTypes };

export default () => definePreviewAddon<DocsTypes>(addonAnnotations);
