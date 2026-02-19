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
 *
 * For non-memory history (e.g., hash history), pass a custom `history` instance in the options.
 *
 * @example
 *
 * ```ts
 * import { createHashHistory } from '@tanstack/react-router';
 * const router = createStoryMemoryRouter({
 *   routeTree,
 *   history: createHashHistory(),
 * });
 * ```
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

/**
 * Type-safe helper for providing default search params in stories. Pass your route type as the
 * generic argument to get autocomplete and type errors against the route's validateSearch schema.
 *
 * This is an identity function at runtime — it returns params unchanged. The generic constraint
 * provides full IDE autocomplete and type errors. x ```ts createStorySearchParams } from
 * '@storybook/tanstack-react'; import { Route as PostsRoute } from './routes/posts';
 *
 * Const search = createStorySearchParams<typeof PostsRoute="">({ page: 1, query: 'hello' });
 *
 * @template TRoute - A route object with a useSearch() method (e.g. typeof MyRoute) @template
 * TRoute - A route object with a useSearch() method (e.g. typeof MyRoute) @param params - The
 * search parameters matching the route's validated search type @param params - The search
 * parameters matching the route's validated search type @returns The same params, typed as the
 * route's validated search type @returns The same params, typed as the route's validated search
 * type
 */
export const createStorySearchParams = <TRoute extends { useSearch: () => any }>(
  params: ReturnType<TRoute['useSearch']>
): ReturnType<TRoute['useSearch']> => params;
