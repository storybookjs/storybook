import type { Decorator } from '@storybook/react';
import type { DecoratorFunction, LoaderFunction, Renderer } from 'storybook/internal/types';
import { defaultDecorateStory } from 'storybook/preview-api';

import type { TanStackParameters } from './types.ts';
import { tanstackRouteDecorator } from './routing/decorator.tsx';
import { routeComponentLoader } from './routing/loader.ts';

export const loaders: LoaderFunction<Renderer>[] = [routeComponentLoader];

/**
 * Compose decorators with two invariants:
 *
 * 1. The React renderer's `jsxDecorator` must remain at position 0 (innermost)
 *    so `context.originalStoryFn` is invoked inside any user-provided context
 *    providers. Otherwise stories that rely on decorator-provided context
 *    (e.g. `useContext`) will throw when source generation runs them.
 * 2. The TanStack router decorator should run as close to the story as possible
 *    so it wraps the actual story render, after user/component decorators have
 *    set up their context.
 *
 * The React renderer's own `applyDecorators` performs the jsxDecorator reorder,
 * but overriding `applyDecorators` here would otherwise drop that behaviour.
 * We replicate it explicitly: jsxDecorator first, then tanstackRouteDecorator,
 * then the rest.
 */
export const applyDecorators = (
  storyFn: Parameters<typeof defaultDecorateStory>[0],
  allDecorators: DecoratorFunction[]
) => {
  const jsxIndex = allDecorators.findIndex(
    (d) =>
      // The React renderer hookifies decorators, so `originalFn` exposes the
      // unwrapped function. We match by name to avoid an import from
      // `@storybook/react`'s docs entry (which has no public types).
      (d as { originalFn?: { name?: string } }).originalFn?.name === 'jsxDecorator' ||
      (d as { name?: string }).name === 'jsxDecorator'
  );

  let reordered: DecoratorFunction[];
  if (jsxIndex === -1) {
    reordered = [tanstackRouteDecorator as DecoratorFunction, ...allDecorators];
  } else {
    const rest = [...allDecorators];
    const [jsxDecorator] = rest.splice(jsxIndex, 1);
    reordered = [jsxDecorator, tanstackRouteDecorator as DecoratorFunction, ...rest];
  }

  return defaultDecorateStory(storyFn, reordered);
};

export const parameters: TanStackParameters = {
  tanstack: {},
};
