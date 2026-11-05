import type { DecoratorFunction } from 'storybook/internal/types';

import './docs/register-print-hole.ts';
import { sourceDecorator } from './docs/sourceDecorator.ts';
import type { SvelteRenderer } from './types.ts';

export const decorators: DecoratorFunction<SvelteRenderer>[] = globalThis.FEATURES?.docgenServer
  ? []
  : [sourceDecorator];
