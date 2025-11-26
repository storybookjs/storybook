import type { DecoratorFunction } from 'storybook/internal/types';

import { sourceDecorator } from './docs/sourceDecorator';
import type { SvelteRenderer } from './types';

export const decorators: DecoratorFunction<SvelteRenderer>[] = [sourceDecorator];
