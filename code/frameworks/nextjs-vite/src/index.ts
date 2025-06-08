import type { ProjectAnnotations } from 'storybook/internal/types';

import type { ReactPreview } from '@storybook/react';
import { __definePreview } from '@storybook/react';
import type { ReactRenderer } from '@storybook/react';

import * as nextPreview from './preview';

export * from '@storybook/react';
// @ts-expect-error (double exports)
export * from './portable-stories';
export * from './types';

export function definePreview(preview: NextPreview['input']) {
  return __definePreview({
    ...preview,
    addons: [
      nextPreview as unknown as ProjectAnnotations<ReactRenderer>,
      ...(preview.addons ?? []),
    ],
  }) as NextPreview;
}

interface NextPreview extends ReactPreview {}
