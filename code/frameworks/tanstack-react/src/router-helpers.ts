import {
  type AnyRouter,
  type Router,
  type RouterHistory,
  type RouterOptions,
  createMemoryHistory,
  createRouter,
} from '@tanstack/react-router';

export interface StoryMemoryRouterOptions {
  routeTree: AnyRouter['routeTree'];
  history?: RouterHistory;
  initialEntries?: string[];
  initialIndex?: number;
  context?: RouterOptions<any, any, any, any, any>['context'];
  createRouter?: (options: RouterOptions<any, any, any, any, any>) => Router<any>;
}

/**
 * Small helper to build a Storybook-friendly TanStack Router using memory history. This keeps
 * stories concise while still exercising a real route tree.
 */
export const createStoryMemoryRouter = (options: StoryMemoryRouterOptions): Router<any> => {
  const createRouterFactory = options.createRouter ?? createRouter;
  const history =
    options.history ??
    createMemoryHistory({
      initialEntries: options.initialEntries ?? ['/'],
      initialIndex: options.initialIndex,
    });

  return createRouterFactory({
    routeTree: options.routeTree,
    history,
    context: options.context,
  });
};
