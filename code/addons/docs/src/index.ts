import type React from 'react';

import { definePreviewAddon } from 'storybook/internal/csf';

import * as addonAnnotations from './preview';
import type { DocsTypes } from './types';

export { DocsRenderer } from './DocsRenderer';
export type { DocsTypes };

declare module 'mdx/types' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    type Element = React.JSX.Element;
    type ElementClass = React.JSX.ElementClass;
    type IntrinsicElements = React.JSX.IntrinsicElements;
  }
}

export default () => definePreviewAddon<DocsTypes>(addonAnnotations);
