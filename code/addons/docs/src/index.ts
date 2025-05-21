import { definePreview } from 'storybook/preview-api';

import * as addonAnnotations from './preview';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore (these types only work once the package is compiled)
export * from '@storybook/addon-docs/blocks';
export { DocsRenderer } from './DocsRenderer';
export type { DocsParameters } from './types';

export default () => definePreview(addonAnnotations);
