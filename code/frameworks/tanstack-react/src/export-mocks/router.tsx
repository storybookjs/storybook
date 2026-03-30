import type { AnyRootRoute, Router } from '@tanstack/react-router';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Route,
} from '@tanstack/react-router';

import { onNavigate } from './spies';
import React, { type ComponentType } from 'react';
import type { RouteParameters, RouterParameters } from '../routing/types';

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
    root.addChildren([routeParameter]);
  } else {
    // @ts-expect-error route options. HARD to make it work when spreading obj.
    const route = createRoute({
      component: () => <Story />,
      ...routeParameter,
    });

    root.addChildren([route]);
  }

  return root;
}

export function createMockRouter({
  routeTree,
  initialPath = '/',
}: MockRouterOptions): Router<AnyRootRoute> {
  const history = createMemoryHistory({
    initialEntries: [initialPath],
  });

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
