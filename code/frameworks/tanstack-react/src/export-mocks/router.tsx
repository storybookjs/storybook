import type { AnyRootRoute, Router } from '@tanstack/react-router';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';

import { onNavigate } from './spies';
import React, { type ComponentType } from 'react';
import type { RouteParameters } from '../routing/types';

export type MockRouterOptions = {
  routeTree: AnyRootRoute;
  initialPath?: string;
};

export function createMockRootRouteFromStory(
  Story: ComponentType,
  _routeOptions?: RouteParameters
): AnyRootRoute {
  const root = createRootRoute();

  const children = createRoute({
    id: 'story',
    component: () => <Story />,
    getParentRoute: () => root,
  });

  root.addChildren([children]);

  return root;
}

export function createMockRouter({
  routeTree,
  initialPath = '/',
}: MockRouterOptions): Router<AnyRootRoute> {
  const history = createMemoryHistory();

  history.replace(initialPath);

  const router = createRouter({
    routeTree,
    history,
  });

  // Listen to navigation events and call the onNavigate spy
  history.block({
    blockerFn: ({ currentLocation, nextLocation, action }) => {
      onNavigate({ to: nextLocation.href, from: currentLocation.href, action });
      return true;
    },
  });

  return router;
}
