import type { DecoratorFunction } from 'storybook/internal/types';

import { jsxDecorator } from './docs/jsxDecorator';
import type { ReactRenderer } from './types';

export const decorators: DecoratorFunction<ReactRenderer>[] =
  'FEATURES' in globalThis && globalThis?.FEATURES?.experimentalCodeExamples ? [] : [jsxDecorator];

export { applyDecorators } from './docs/applyDecorators';

export const parameters = {
  docs: {
    story: { inline: true },
  },
};
