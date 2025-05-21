import { definePreviewAddon } from 'storybook/internal/csf';

import * as addonAnnotations from './preview';
import type { DocsTypes } from './types';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore (these types only work once the package is compiled)
export * from '@storybook/addon-docs/blocks';
export { DocsRenderer } from './DocsRenderer';
export type { DocsTypes };

export default () => definePreviewAddon<DocsTypes>(addonAnnotations);
