import type { DecoratorFunction } from 'storybook/internal/types';

import { fillTemplate } from './docs/fill-template.ts';
import { sourceDecorator } from './docs/sourceDecorator.ts';
import type { SvelteRenderer } from './types.ts';

export const decorators: DecoratorFunction<SvelteRenderer>[] = [sourceDecorator];

export const parameters = {
  docs: {
    source: { fillTemplate },
  },
};
