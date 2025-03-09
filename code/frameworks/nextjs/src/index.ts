import type { ReactPreview } from '@storybook/react';
import { __definePreview } from '@storybook/react';

import * as nextPreview from './preview';

export * from './types';
export * from './portable-stories';

export function definePreview(preview: NextPreview['input']) {
  return __definePreview({
    ...preview,
    addons: [nextPreview, ...(preview.addons ?? [])],
  }) as NextPreview;
}

interface NextPreview extends ReactPreview {}
