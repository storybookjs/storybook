import type { DecoratorFunction } from 'storybook/internal/types';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { jsxDecorator } from './docs/jsxDecorator';
import type { ReactRenderer } from './types';

// eslint-disable-next-line no-var
declare var FEATURES: NonNullable<StorybookConfigRaw['features']>;

export const decorators: DecoratorFunction<ReactRenderer>[] = FEATURES.experimentalCodeExamples
  ? []
  : [jsxDecorator];

export { applyDecorators } from './docs/applyDecorators';

export const parameters = {
  docs: {
    story: { inline: true },
  },
};
