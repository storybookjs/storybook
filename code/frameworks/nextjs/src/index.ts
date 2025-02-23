import type { ReactPreview } from '@storybook/react';
import { definePreview as definePreviewBase } from '@storybook/react';

import * as nextPreview from './preview';

export * from './types';
export * from './portable-stories';

export function definePreview(preview: NextPreview['input']) {
  return definePreviewBase({
    ...preview,
    addons: [nextPreview, ...(preview.addons ?? [])],
  }) as NextPreview;
}

interface NextPreview extends ReactPreview {}
