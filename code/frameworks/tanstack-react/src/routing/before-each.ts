import type { Decorator } from '@storybook/react-vite';
import type { AnyRootRoute, Router } from '@tanstack/react-router';
import type { BeforeEach, Renderer } from 'storybook/internal/types';

import { createStoryRouter, StoryFromContext } from './decorator.tsx';
import type { RouterParameters } from './types.ts';

/**
 * Routers cached per story so same-story re-renders
 */
const storyRouters = new Map<string, Router<AnyRootRoute>>();

/**
 * Creates the story router and resolves its initial load before the story renders.
 * `RouterProvider` only triggers a mount-time `router.load()` conditionally, so rendering an
 * unloaded router can commit an empty canvas and let play functions run against it.
 */
export const routerBeforeEach: BeforeEach<Renderer> = async (context) => {
  const cached = storyRouters.get(context.id);
  if (cached) {
    context.tanstackRouter = cached;
    return;
  }

  const storyContext = context as unknown as Parameters<Decorator>[1];
  const routerParameters: RouterParameters = context.parameters.tanstack?.router ?? {};
  const router = createStoryRouter({
    Story: StoryFromContext,
    context: storyContext,
    // useRouterContext needs a react context.
    // The context will be merged with the router context and passed to the Story component in the decorator
    routerContext: routerParameters.context,
  });
  const load = router.load();

  if (context.abortSignal && !context.abortSignal.aborted) {
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
    return;
  }

  storyRouters.set(context.id, router);
  context.tanstackRouter = router;
  return () => {
    storyRouters.delete(context.id);
  };
};
