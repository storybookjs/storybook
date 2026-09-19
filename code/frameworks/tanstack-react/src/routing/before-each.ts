import type { Decorator } from '@storybook/react-vite';
import type { AnyRootRoute, Router } from '@tanstack/react-router';
import type { BeforeEach, Renderer } from 'storybook/internal/types';

import { createStoryRouter, StoryFromContext } from './decorator.tsx';
import type { RouterParameters } from './types.ts';

const storyRouters = new Map<string, Router<AnyRootRoute>>();

/** Creates and initially loads each story router before the story renders. */
export const routerBeforeEach: BeforeEach<Renderer> = async (context) => {
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
