import { SourceType } from 'storybook/internal/docs-tools';
import type { DecoratorFunction } from 'storybook/internal/types';

import { sourceDecorator } from './docs/sourceDecorator';
import type { WebComponentsRenderer } from './types';

export const decorators: DecoratorFunction<WebComponentsRenderer>[] = [sourceDecorator];

export const parameters = {
  docs: {
    source: {
      type: SourceType.DYNAMIC,
      language: 'html',
    },
    story: { inline: true },
  },
};
