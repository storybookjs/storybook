import type { AnyRootRoute, AnyRoute, Router } from '@tanstack/react-router';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Route,
} from '@tanstack/react-router';

import { fn } from 'storybook/test';
import React, { type ComponentType } from 'react';
import type { RouteParameters, RouterParameters } from '../routing/types';
import { useEffect } from 'storybook/internal/preview-api';
import type { Navigate as _Navigate } from '@tanstack/react-router';

export type MockRouterOptions = {
  routeTree?: AnyRootRoute;
  initialPath?: string;
};

export function createStoryRoute(
  Story: ComponentType,
  routeParameter?: RouterParameters['route']
): AnyRootRoute {
  const root = createRootRoute();

  if (routeParameter instanceof Route) {
    routeParameter.update({
      component: () => <Story />,
    });

    // @ts-expect-error why createRoute returns a RootRoute ???
    return routeParameter;
  } else {
    // @ts-expect-error route options. HARD to make it work when spreading obj.
    const route = createRoute({
      component: () => <Story />,
      ...routeParameter,
      path: '/',
      getParentRoute: () => root,
    });

    root.addChildren([route]);
  }

  return root;
}

export function createMockRouter({
  routeTree,
  initialPath = '/',
}: MockRouterOptions): Router<AnyRootRoute> {
  const history = createMemoryHistory();

  console.log('init mock router with path:', initialPath);
  const router = createRouter({
    routeTree,
    history,
  });

  history.replace(initialPath);
  history.block({
    blockerFn() {
      return true;
    },
  });

  return router;
}

// Mock navigation hooks — use these in stories to assert navigation calls
export const useNavigate = fn().mockName('@tanstack/react-router::useNavigate');
export const useRouter = fn().mockName('@tanstack/react-router::useRouter');
export const useBlocker = fn().mockName('@tanstack/react-router::useBlocker');
export const useMatch = fn().mockName('@tanstack/react-router::useMatch');
export const useSearch = fn().mockName('@tanstack/react-router::useSearch');
export const useParams = fn().mockName('@tanstack/react-router::useParams');
export const useLocation = fn().mockName('@tanstack/react-router::useLocation');
export const useRouterState = fn().mockName('@tanstack/react-router::useRouterState');
export const useMatchRoute = fn().mockName('@tanstack/react-router::useMatchRoute');
export const useLoaderData = fn().mockName('@tanstack/react-router::useLoaderData');
export const useLoaderDeps = fn().mockName('@tanstack/react-router::useLoaderDeps');
export const useRouteContext = fn().mockName('@tanstack/react-router::useRouteContext');
export const useMatches = fn().mockName('@tanstack/react-router::useMatches');
export const useParentMatches = fn().mockName('@tanstack/react-router::useParentMatches');
export const useChildMatches = fn().mockName('@tanstack/react-router::useChildMatches');
export const useCanGoBack = fn().mockName('@tanstack/react-router::useCanGoBack');
export const useLinkProps = fn().mockName('@tanstack/react-router::useLinkProps');

export const Outlet = () => null;

export const Navigate: typeof _Navigate = ({ to, href }) => {
  useEffect(() => {
    // log the navigation in the aciton panel
    useNavigate({ to, href });
  }, []);

  return null;
};

export const Link = ({
  to,
  children,
  ...props
}: {
  to: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}) =>
  React.createElement(
    'a',
    {
      href: to,
      onClick: (e: React.MouseEvent) => {
        e.preventDefault();
        useNavigate({ to });
      },
      ...props,
    },
    children
  );
