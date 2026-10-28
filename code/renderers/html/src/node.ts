import { defineRenderer } from '@storybook/core';

import { getPreviewAnnotations } from './preview-annotations.ts';
import type { HtmlRenderer } from './types.ts';

export type { HtmlRenderer } from './types.ts';

/** Configure HTML rendering and its preview annotations. */
export const html = defineRenderer<void, HtmlRenderer>(() => ({
  meta: { name: '@storybook/html' },
  setup(storybook): void {
    storybook.hook('preview:annotations:collect', async () =>
      getPreviewAnnotations(await storybook.callHook('core:docs:extend', {}))
    );
  },
}));

export default html;
