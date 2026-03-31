import { createRootRoute, createRoute, type AnyRootRoute } from '@tanstack/react-router';
import type { CreateStoryRouteOptions } from './types';

// todo type it generic with tanstack start
export const createStoryRoute = (options: CreateStoryRouteOptions): AnyRootRoute => {
  const root = createRootRoute();

  // @ts-expect-error - route options. HARD to make it work when spreading obj.
  const route = createRoute({
    getParentRoute: () => root,
    ...options,
  });

  root.addChildren([route]);

  return root;
};
