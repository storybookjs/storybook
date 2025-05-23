import { SourceType } from 'storybook/internal/docs-tools';
import type { DecoratorFunction } from 'storybook/internal/types';

import { sourceDecorator } from './docs/sourceDecorator';
import type { HtmlRenderer } from './types';

export const decorators: DecoratorFunction<HtmlRenderer>[] = [sourceDecorator];

export const parameters = {
  docs: {
    story: { inline: true },
    source: {
      type: SourceType.DYNAMIC,
      language: 'html',
      code: undefined,
      excludeDecorators: undefined,
    },
  },
};
