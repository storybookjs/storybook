import type { Decorator, ReactRenderer } from '@storybook/react-vite';
import type { AnyRootRoute, Router } from '@tanstack/react-router';
import type { BaseAnnotations, BeforeEach, Renderer } from 'storybook/internal/types';
// @ts-expect-error untyped
import { mount as reactMount } from '@storybook/react/entry-preview';

import { createStoryRouter, StoryFromContext } from './decorator.tsx';
import type { RouterParameters } from './types.ts';

const storyRouters = new Map<string, Router<AnyRootRoute>>();
const loadedRouters = new WeakSet<Router<AnyRootRoute>>();

/** Creates each story router so it is available on the context to every `beforeEach`. */
export const routerBeforeEach: BeforeEach<Renderer> = (context) => {
  const cached = storyRouters.get(context.id);
  if (cached) {
    context.tanstackRouter = cached;
    return;
  }

  const storyContext = context as unknown as Parameters<Decorator>[1];
  const routerParameters: RouterParameters = context.parameters.tanstack?.router ?? {};
  const parameterContext = routerParameters.context;
  const routerContext =
    typeof parameterContext === 'function' ? parameterContext({ storyContext }) : parameterContext;
  const router = createStoryRouter({
    Story: StoryFromContext,
    context: storyContext,
    routerContext,
  });

  storyRouters.set(context.id, router);
  context.tanstackRouter = router;
  return () => {
    storyRouters.delete(context.id);
  };
};

/**
 * Initially loads the story router right before rendering, so route `beforeLoad` and `loader` see
 * what every `beforeEach` (or a `play` function calling `mount`) has set up.
 */
export const routerMount: BaseAnnotations<ReactRenderer>['mount'] =
  (context) =>
  async (...args) => {
    const router = context.tanstackRouter as Router<AnyRootRoute> | undefined;
    if (router && !loadedRouters.has(router)) {
      if (context.abortSignal?.aborted) {
        return context.canvas;
      }
      const load = router.load();
      if (context.abortSignal) {
        load.catch(() => {});
        await Promise.race([
          load,
          new Promise<void>((resolve) =>
            context.abortSignal.addEventListener('abort', () => resolve(), { once: true })
          ),
        ]);
      } else {
        await load;
      }
      if (context.abortSignal?.aborted) {
        return context.canvas;
      }
      loadedRouters.add(router);
    }
    return reactMount(context)(...args);
  };
