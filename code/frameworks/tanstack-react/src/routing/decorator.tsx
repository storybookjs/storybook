import React, { type ComponentType } from 'react';
import type { Decorator } from '@storybook/react-vite';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  type Route,
  RouterProvider,
  type RootRoute,
  interpolatePath,
  defaultStringifySearch,
} from '@tanstack/react-router';
import type { Router, AnyRootRoute, AnyRoute } from '@tanstack/react-router';
import type { RouterParameters } from './types.ts';
import {
  duplicateRouteTree,
  findRootRoute,
  mountPathFor,
  resolveStoryLeaf,
  type DuplicatedTree,
} from './duplicate-tree.ts';
import { isRoute } from './utils.ts';
import { normalizeFileRoutePath } from './path-utils.ts';

interface TanStackRouterStoryProps {
  Story: ComponentType;
  context: Parameters<Decorator>[1];
}

type MockRouterOptions = {
  Story: ComponentType;
  context: Parameters<Decorator>[1];
  routerContext?: Record<string, unknown>;
};

interface ResolvedTree {
  tree: DuplicatedTree;
  leaf: AnyRoute;
}

const StoryContext = React.createContext<{ Story: ComponentType }>({ Story: () => null });

const StoryFromContext: ComponentType = () => {
  const { Story } = React.useContext(StoryContext);
  return <Story />;
};

export const tanstackRouteDecorator: Decorator = (Story, context) => {
  return <TanStackRouterStory Story={Story} context={context} />;
};

function TanStackRouterStory({ Story, context }: TanStackRouterStoryProps) {
  const routerContext = context.parameters.tanstack?.router?.useRouterContext?.({
    storyContext: context,
  });

  const router = React.useMemo(
    () => createStoryRouter({ Story: StoryFromContext, context, routerContext }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [context.id]
  );

  const providerContext = React.useMemo(
    () => ({
      ...context.parameters.tanstack?.router?.context,
      ...routerContext,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [context.id, routerContext]
  );

  return (
    <StoryContext.Provider value={{ Story }}>
      <RouterProvider router={router} context={providerContext}></RouterProvider>
    </StoryContext.Provider>
  );
}

export function createStoryRouter({
  Story,
  context,
  routerContext,
}: MockRouterOptions): Router<AnyRootRoute> {
  const routerParameters: RouterParameters = context.parameters.tanstack?.router ?? {};
  const { tree, leaf } = resolveTree(Story, context);
  const routeTree = tree.root;

  // Infer the initial path for the router. Cloned routes are not yet
  // `init()`ed here, so the `fullPath` getter is only usable for routes that
  // already lived in an initialized router; `mountPathFor` walks the cloned
  // parent chain's options instead and always yields a mountable URL.
  const inferredPath =
    routerParameters?.path ||
    leaf.fullPath ||
    (leaf.id ? normalizeFileRoutePath(leaf.id) : undefined) ||
    mountPathFor(leaf);

  // Interpolate params into the path and append query/search params.
  let resolvedPath = interpolatePath({
    path: inferredPath,
    params: routerParameters?.params ?? {},
  }).interpolatedPath;
  const search = routerParameters?.query ? defaultStringifySearch(routerParameters.query) : '';
  if (search) {
    resolvedPath += search;
  }
  const history = createMemoryHistory({
    initialEntries: [resolvedPath],
  });

  history.replace(resolvedPath);

  return createRouter({
    routeTree,
    history,
    defaultNotFoundComponent(props) {
      return <div>Route not found: {props.routeId}</div>;
    },
    defaultErrorComponent({ error }) {
      return <div>Story did something wrong : {String(error)}</div>;
    },
    context: routerContext,
  });
}

/**
 * A pathless layout (explicit `id`, no `path`) only matches when one of its
 * children matches. If a story is bound directly to such a route, return an
 * index child (`path: '/'`) under it so the layout becomes matchable and path
 * inference resolves to a real URL: reuse the layout's existing index child
 * when it has one (the common `_authed/index.tsx` shape — attaching a
 * synthetic sibling would derive the same generated id and make
 * `createRouter` throw `Duplicate routes found`), otherwise mount a synthetic
 * bare index child. The story itself still renders at the layout's position —
 * `injectStoryComponent` already replaced the layout's own `component`.
 */
function ensureMatchableLeaf(tree: DuplicatedTree, leaf: AnyRoute): AnyRoute {
  const isPathlessLeaf =
    leaf !== (tree.root as unknown as AnyRoute) &&
    !(leaf as any).options?.path &&
    (leaf as any).options?.id != null;
  if (!isPathlessLeaf) {
    return leaf;
  }
  const existingIndexChild = (((leaf as any).children as AnyRoute[] | undefined) ?? []).find(
    (child) => (child as any).options?.path === '/'
  );
  if (existingIndexChild) {
    return existingIndexChild;
  }
  const syntheticLeaf = createRoute({
    path: '/',
    component: () => null,
    getParentRoute: () => leaf as any,
  } as any);
  (leaf as any).addChildren([
    ...(((leaf as any).children as AnyRoute[] | undefined) ?? []),
    syntheticLeaf,
  ]);
  return syntheticLeaf as unknown as AnyRoute;
}

function injectStoryComponent(
  leaf: AnyRoute,
  Story: ComponentType,
  overrides: RouterParameters['routeOverrides'],
  leafId: string
) {
  // Respect explicit user override of the leaf's component.
  const userOverride = (overrides as Record<string, any> | undefined)?.[leafId];
  if (userOverride && 'component' in userOverride && userOverride.component !== undefined) {
    return;
  }
  (leaf as any).update({ component: () => <Story /> });
}

/**
 * Resolves the route tree and leaf to render for a given story, based on the following inputs (in order of precedence):
 * 1. `parameters.tanstack.router.route` (if it's a Route instance)
 * 2. `route` from the story's meta (if it's a Route instance)
 * 3. A synthetic root + child created from plain options in `parameters.tanstack.router.route` (if it's a plain object)
 * 4. A synthetic root + child with no options.
 *
 * If the resolved route isn't already a root, walks up its parent chain to find the enclosing root, and duplicates the entire tree under that root to ensure isolation between stories.
 * The story component is injected at the resolved leaf route.
 * If no route can be resolved from the inputs, creates a synthetic root and injects the story at a child route.
 *
 */
function resolveTree(Story: ComponentType, context: Parameters<Decorator>[1]): ResolvedTree {
  const metaRoute = context.route as Route | RootRoute | undefined;
  const routerParameters: RouterParameters = context.parameters.tanstack?.router ?? {};
  const routerParameterRoute = routerParameters.route;
  const routeOverrides = routerParameters.routeOverrides;

  const resolvedRoute = isRoute(routerParameterRoute)
    ? routerParameterRoute
    : isRoute(metaRoute)
      ? metaRoute
      : undefined;

  // `resolvedRoute` may already be a `RootRoute` (e.g. the `routeTree` from
  // `routeTree.gen.ts`); `findRootRoute` returns it unchanged in that case,
  // otherwise it walks up `getParentRoute()` to the enclosing root.
  const rootRoute = resolvedRoute ? findRootRoute(resolvedRoute) : undefined;

  if (rootRoute) {
    // The user provided a route that's already connected to a root. Use it as the leaf of a duplicated tree.
    // Could be a custom RootRoute or the whole application RouteTree.
    const tree = duplicateRouteTree(rootRoute, { overrides: routeOverrides });
    const leaf = resolveStoryLeaf(tree, {
      path: routerParameters.path as string | undefined,
      boundRouteId: resolvedRoute && resolvedRoute !== rootRoute ? resolvedRoute.id : undefined,
    });

    injectStoryComponent(leaf, Story, routeOverrides, leaf.id);
    const renderLeaf = ensureMatchableLeaf(tree, leaf);
    return { tree, leaf: renderLeaf };
  }

  if (isRoute(routerParameterRoute)) {
    // The user provided a route instance that isn't connected to any root.
    // Could be a simple Route import from a Route file.
    // Use it as the leaf of a new synthetic root, and duplicate it to ensure any nested children are cloned properly.
    const syntheticRoot = createRootRoute(
      (routeOverrides as Record<string, any> | undefined)?.__root__ ?? {}
    );
    routerParameterRoute.update({ getParentRoute: () => syntheticRoot } as any);
    syntheticRoot.addChildren([routerParameterRoute]);
    const tree = duplicateRouteTree(syntheticRoot, { overrides: routeOverrides });
    const leaf = tree.byId.get(routerParameterRoute.id) ?? tree.root;
    injectStoryComponent(leaf, Story, routeOverrides, leaf.id);
    const renderLeaf = ensureMatchableLeaf(tree, leaf);
    return { tree, leaf: renderLeaf };
  }

  // No route instance — build a synthetic root + child from plain options.
  const plainOptions = routerParameterRoute ?? {};
  const {
    path: plainRoutePath,
    id: plainRouteId,
    ...plainRouteRest
  } = plainOptions as Record<string, unknown>;
  const syntheticRouteId = plainRoutePath
    ? undefined
    : ((plainRouteId as string | undefined) ?? 'storybook-story');
  const syntheticRoot = createRootRoute(
    (routeOverrides as Record<string, any> | undefined)?.__root__ ?? {}
  );
  const syntheticChild = createRoute({
    component: () => <Story />,
    id: syntheticRouteId,
    path: plainRoutePath as string | undefined,
    ...plainRouteRest,
    getParentRoute: () => syntheticRoot,
  } as any);
  syntheticRoot.addChildren([syntheticChild]);

  injectStoryComponent(syntheticChild, Story, routeOverrides, syntheticChild.id);
  return {
    tree: { root: syntheticRoot, byId: new Map([[syntheticChild.id, syntheticChild]]) },
    leaf: syntheticChild,
  };
}
