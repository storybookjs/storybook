import type { AnyRoute, FileRoutesByPath } from '@tanstack/react-router';
import type {
  AnyContext,
  ResolveLoaderData,
  ResolveParams,
  ResolveSearchSchema,
  RouteOptions,
} from '@tanstack/router-core';
import type { Decorator } from '@storybook/react';

export type IsRoute<T> = T extends AnyRoute
  ? true
  : T extends FileRoutesByPath[keyof FileRoutesByPath]
    ? true
    : false;

export type IsFileRoute<TRoute> = TRoute extends FileRoutesByPath[keyof FileRoutesByPath]
  ? true
  : false;

type ExtractAllPathsFromFileRoutes<
  TRoute extends FileRoutesByPath[keyof FileRoutesByPath]['preLoaderRoute'] | AnyRoute,
> = TRoute['path'];

export type StoryRoutePath<TRoute = undefined> =
  TRoute extends FileRoutesByPath[keyof FileRoutesByPath]
    ? ExtractAllPathsFromFileRoutes<TRoute>
    : keyof FileRoutesByPath | `/${string}`;

/**
 * Helper: convert a union `A | B | C` into an intersection `A & B & C`.
 *
 * Used to gather all per-route `allParams` shapes from the registered file
 * route tree into a single object whose keys are the union of every nested
 * route's params.
 */
type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;

/**
 * Union of `allParams` from every registered nested file route.
 *
 * This is used when the bound route is a `RootRoute` / route tree (whose own
 * `allParams` is empty), so users can still pass params for any nested route
 * matched via `path`. The result is `Partial` so every key is optional.
 */
type AllRegisteredParams = Partial<
  UnionToIntersection<
    {
      [K in keyof FileRoutesByPath]: FileRoutesByPath[K]['preLoaderRoute'] extends {
        types: { allParams: infer A };
      }
        ? A
        : never;
    }[keyof FileRoutesByPath]
  >
>;

type StoryRouteParams<TRoute> =
  TRoute extends FileRoutesByPath[keyof FileRoutesByPath]['preLoaderRoute']
    ? ResolveParams<ExtractAllPathsFromFileRoutes<TRoute>>
    : IsRoute<TRoute> extends true
      ? TRoute extends { types: { allParams: infer P } }
        ? unknown extends P
          ? AllRegisteredParams
          : keyof P extends never
            ? AllRegisteredParams
            : P
        : AllRegisteredParams
      : AllRegisteredParams;

type StoryRouteSearch<TRoute> =
  IsRoute<TRoute> extends true
    ? TRoute extends { types: { fullSearchSchema: infer S } }
      ? unknown extends S
        ? Record<string, unknown>
        : S
      : Record<string, unknown>
    : Record<string, unknown>;

export type StoryRouteFileOptions<TRoute = undefined> =
  IsRoute<TRoute> extends true
    ? TRoute extends { options: infer O }
      ? Pick<
          O,
          Extract<
            keyof O,
            | 'loader'
            | 'beforeLoad'
            | 'validateSearch'
            | 'loaderDeps'
            | 'context'
            | 'params'
            | 'head'
            | 'search'
            | 'parseParams'
            | 'context'
          >
        >
      : Pick<
          RouteOptions<unknown>,
          | 'loader'
          | 'beforeLoad'
          | 'validateSearch'
          | 'loaderDeps'
          | 'context'
          | 'params'
          | 'head'
          | 'search'
          | 'parseParams'
          | 'context'
        >
    : Pick<
        RouteOptions<unknown>,
        | 'loader'
        | 'beforeLoad'
        | 'validateSearch'
        | 'loaderDeps'
        | 'context'
        | 'params'
        | 'head'
        | 'search'
        | 'parseParams'
        | 'context'
      >;

export type CreateStoryRouteOptions<TRoute = undefined> = StoryRouteFileOptions<TRoute> & {
  path?: StoryRoutePath<TRoute>;
};

export type StoryRouteOptions<TRoute = undefined> = CreateStoryRouteOptions<TRoute> | AnyRoute;

/**
 * Per-route override options for use inside `RouteTreeOverrides`.
 * Users can override `loader`, `beforeLoad`, etc. for a specific route.
 */
export interface RouteOverrideOptions<
  TRoute extends FileRoutesByPath[keyof FileRoutesByPath]['preLoaderRoute'] | undefined = undefined,
> {
  /** Override the route's loader function. */
  loader?: TRoute extends FileRoutesByPath[keyof FileRoutesByPath]['preLoaderRoute']
    ? TRoute['options']['loader'] | ((ctx: unknown) => Promise<unknown> | unknown)
    : (ctx: unknown) => Promise<unknown> | unknown;
  /** Override the route's beforeLoad function. */
  beforeLoad?: TRoute extends FileRoutesByPath[keyof FileRoutesByPath]['preLoaderRoute']
    ? TRoute['options']['beforeLoad'] | ((ctx: unknown) => Promise<void> | void)
    : (ctx: unknown) => Promise<void> | void;
  /** Override the route's search params validation. */
  validateSearch?: TRoute extends FileRoutesByPath[keyof FileRoutesByPath]['preLoaderRoute']
    ? TRoute['options']['validateSearch'] | ((search: unknown) => Promise<void> | void)
    : (search: unknown) => Promise<void> | void;
  /** Override the route's loader dependencies. */
  loaderDeps?: TRoute extends FileRoutesByPath[keyof FileRoutesByPath]['preLoaderRoute']
    ? TRoute['options']['loaderDeps'] | string[]
    : string[];
  /** Override the route's context function. */
  context?: TRoute extends FileRoutesByPath[keyof FileRoutesByPath]['preLoaderRoute']
    ? TRoute['options']['context'] | ((ctx: unknown) => Promise<unknown> | unknown)
    : (ctx: unknown) => Promise<unknown> | unknown;
}

/**
 * A map of route overrides keyed by route ID.
 * Each entry can override `loader`, `beforeLoad`, etc. for that route.
 *
 * @example
 * ```ts
 * routeOverrides: {
 *   '/_authed': { beforeLoad: () => {} },
 *   '/demo/form/simple/$id': {
 *     loader: async () => ({ name: 'Mock User' }),
 *   },
 * }
 * ```
 */
export type RouteTreeOverrides = Partial<{
  [routePath in keyof FileRoutesByPath]:
    | RouteOverrideOptions<FileRoutesByPath[routePath]['preLoaderRoute']>
    | undefined;
}>;

export interface RouterParameters<TRoute = undefined> {
  route?: StoryRouteOptions<TRoute>;
  /** The initial URL path to render. */
  path?: StoryRoutePath<TRoute>;
  /** URL params to interpolate into the path (e.g. `{ id: '42' }` for `/$id`). */
  params?: StoryRouteParams<TRoute>;
  /** Search/query params to append to the URL (e.g. `{ tab: 'details' }`). */
  query?: Partial<StoryRouteSearch<TRoute>>;
  /**
   * Override options for specific routes in the app route tree (route tree mode only).
   *
   * Each key is a route ID (e.g. `'/about'`, `'__root__'`, `'/demo/form/simple/$id'`).
   * Values can override `loader`, `beforeLoad`, etc. for that route.
   *
   * @example
   * ```ts
   * routeOverrides: {
   *   '/_authed': { beforeLoad: () => {} },
   *   '/demo/form/simple/$id': {
   *     loader: async () => ({ name: 'Mock User' }),
   *   },
   * }
   * ```
   */
  routeOverrides?: RouteTreeOverrides;

  context?: Record<string, unknown>;

  /**
   *
   */
  useRouterContext?: ({ storyContext }: { storyContext: Parameters<Decorator>[1] }) => AnyContext;
}
