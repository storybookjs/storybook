import type { DecoratorFunction } from 'storybook/internal/types';

import { sourceDecorator } from './docgen/source-decorator/sourceDecorator.ts';
import type { SvelteRenderer } from './types.ts';

export const decorators: DecoratorFunction<SvelteRenderer>[] = globalThis.FEATURES?.docgenServer
  ? []
  : [sourceDecorator];
