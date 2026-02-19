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
 * Type-safe helper for creating search params that match a route's search type.
 *
 * Ensures that search parameters passed to navigation or used in a story conform to the route's
 * `useSearch()` hook. This is an identity function at runtime but provides full TypeScript
**
 * Validation.  c  ```
 *@e 
 *
 * @template TRoute - A route type with a `useSearch()` method
 * @param params - The search parameters matching the route's search schema
 * @returns The same params, with type safety verifiedmplate TRoute - A route type with a `useSearch()` method
 * @param params - The search parameters matching the route's search schema
 * @returns The same params, with type safety verified
 * ```
 */
export const createStorySearchParams = <TRoute extends { useSearch: () => any }>(
  params: ReturnType<TRoute['useSearch']>
 * ```
): ReturnType<TRoute['useSearch']> => params;
