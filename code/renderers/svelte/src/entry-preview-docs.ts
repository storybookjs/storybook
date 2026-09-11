import type { DecoratorFunction } from 'storybook/internal/types';

import { sourceDecorator } from './docs/sourceDecorator.ts';
import type { SvelteRenderer } from './types.ts';

export const decorators: DecoratorFunction<SvelteRenderer>[] = [sourceDecorator];
