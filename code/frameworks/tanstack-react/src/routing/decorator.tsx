import React, { type ComponentType } from 'react';
import type { Decorator } from '@storybook/react-vite';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Route,
  RouterProvider,
  RootRoute,
  interpolatePath,
  defaultStringifySearch,
} from '@tanstack/react-router';
import type { Router, AnyRootRoute, AnyRoute } from '@tanstack/react-router';
import type { RouterParameters } from './types.ts';
import {
  duplicateRouteTree,
  findRootRoute,
  resolveStoryLeaf,
  type DuplicatedTree,
} from './duplicate-tree.ts';

export type MockRouterOptions = {
  Story: ComponentType;
  context: Parameters<Decorator>[1];
  routerContext?: Record<string, unknown>;
};

/**
 * Checks whether a value is a TanStack Router Route instance.
 */
function isRoute(value: unknown): value is InstanceType<typeof Route> {
  // todo: check if works with multiple versions of the router in a monorepo
  return value instanceof Route || value instanceof RootRoute;
}

interface ResolvedTree {
  tree: DuplicatedTree;
  leaf: AnyRoute;
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
    const tree = duplicateRouteTree(rootRoute, { overrides: routeOverrides });
    const leaf = resolveStoryLeaf(tree, {
      path: routerParameters.path as string | undefined,
      boundRouteId: resolvedRoute && resolvedRoute !== rootRoute ? resolvedRoute.id : undefined,
    });

    injectStoryComponent(leaf, Story, routeOverrides, leaf.id);
    return { tree, leaf };
  }

  // No route instance — build a synthetic root + child from plain options, then
  // run it through `duplicateRouteTree` so any nested `children` Route instances
  // attached to the user's plain options are cloned too.
  const plainOptions = (routerParameterRoute ?? {}) as Record<string, unknown>;
  const { children: plainChildren, ...plainRest } = plainOptions as {
    children?: AnyRoute[];
    [k: string]: unknown;
  };
  const syntheticRoot = createRootRoute(
    (routeOverrides as Record<string, any> | undefined)?.__root__ ?? {}
  );
  const syntheticChild = createRoute({
    component: () => <Story />,
    ...plainRest,
    path: ((plainRest as { path?: string }).path ?? '/') as any,
    getParentRoute: () => syntheticRoot,
  } as any);
  if (plainChildren?.length) {
    for (const child of plainChildren) {
      child.options.getParentRoute = () => syntheticChild;
      child.update({ getParentRoute: () => syntheticChild } as any);
    }
    syntheticChild.addChildren(plainChildren);
  }
  syntheticRoot.addChildren([syntheticChild]);

  const tree = duplicateRouteTree(syntheticRoot as any, { overrides: routeOverrides });
  const leaf = tree.byId.get(syntheticChild.id) ?? (tree.root as unknown as AnyRoute);
  injectStoryComponent(leaf, Story, routeOverrides, leaf.id);
  return { tree, leaf };
}

function createStoryRouter({
  Story,
  context,
  routerContext,
}: MockRouterOptions): Router<AnyRootRoute> {
  const routerParameters: RouterParameters = context.parameters.tanstack?.router ?? {};
  const { tree, leaf } = resolveTree(Story, context);
  const routeTree = tree.root;

  const inferredPath =
    routerParameters?.path ||
    leaf.fullPath ||
    (routeTree.children as AnyRoute[] | undefined)?.[0]?.fullPath ||
    '/';

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

  const router = createRouter({
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
  return router;
}

export const tanstackRouteDecorator: Decorator = (Story, context) => {
  return <TanStackRouterStory Story={Story} context={context} />;
};

interface TanStackRouterStoryProps {
  Story: ComponentType;
  context: Parameters<Decorator>[1];
}

function TanStackRouterStory({ Story, context }: TanStackRouterStoryProps) {
  const storyRef = React.useRef(Story);
  storyRef.current = Story;
  const StableStory = React.useCallback(() => {
    const Current = storyRef.current;
    return <Current />;
  }, []);

  const routerContext = context.parameters.tanstack?.router?.useRouterContext?.({
    storyContext: context,
  });

  const routerParametersKey = React.useMemo(
    () => safeStringify(context.parameters.tanstack?.router),
    [context.parameters.tanstack?.router]
  );

  const router = React.useMemo(
    () =>
      createStoryRouter({
        Story: StableStory,
        context,
        routerContext,
      }),
    // We deliberately key on the story id + serialized router params, not on
    // `context` itself (which changes every render due to new args).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [context.id, routerParametersKey, routerContext]
  );

  return (
    <RouterProvider
      router={router}
      context={{
        ...context.parameters.tanstack?.router?.context,
        ...routerContext,
      }}
    ></RouterProvider>
  );
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, (_, v) =>
      typeof v === 'function' ? `__fn:${(v as Function).name || 'anon'}` : v
    );
  } catch {
    return '';
  }
}
