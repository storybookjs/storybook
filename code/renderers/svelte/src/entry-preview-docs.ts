import type { DecoratorFunction } from 'storybook/internal/types';

import { fillTemplate } from './docs/fill-template.ts';
import { sourceDecorator } from './docs/sourceDecorator.ts';
import type { SvelteRenderer } from './types.ts';

export const decorators: DecoratorFunction<SvelteRenderer>[] = globalThis.FEATURES?.docgenServer
  ? []
  : [sourceDecorator];

// Under the docgen server, the story-docs `template` follows the controls, filled with the args.
export const parameters = globalThis.FEATURES?.docgenServer
  ? { docs: { source: { fillTemplate } } }
  : {};
