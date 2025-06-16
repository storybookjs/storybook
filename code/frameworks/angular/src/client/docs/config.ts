import { SourceType } from 'storybook/internal/docs-tools';
import type { DecoratorFunction, Parameters } from 'storybook/internal/types';

import { sourceDecorator } from './sourceDecorator';

export const parameters: Parameters = {
  docs: {
    source: {
      type: SourceType.DYNAMIC,
      language: 'html',
    },
  },
};

export const decorators: DecoratorFunction[] = [sourceDecorator];
