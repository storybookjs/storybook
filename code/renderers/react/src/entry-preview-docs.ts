import type { DecoratorFunction } from 'storybook/internal/types';

import { jsxDecorator } from './docs/jsxDecorator.tsx';
import type { ReactRenderer } from './types.ts';

export const decorators: DecoratorFunction<ReactRenderer>[] =
  'FEATURES' in globalThis && globalThis?.FEATURES?.experimentalCodeExamples ? [] : [jsxDecorator];

export { applyDecorators } from './docs/applyDecorators.ts';

export const parameters = {
  docs: {
    story: { inline: true },
  },
};
