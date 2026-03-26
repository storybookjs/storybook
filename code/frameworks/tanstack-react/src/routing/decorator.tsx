import React from 'react';
import type { Decorator } from '@storybook/react-vite';
import { RouterProvider } from '@tanstack/react-router';
import { createMockRootRouteFromStory, createMockRouter } from '../export-mocks';
import type { RouterParameters } from './types';

export const tanstackRouteDecorator: Decorator = (Story, context) => {
  const routerParams: RouterParameters = context.parameters.tanstack.router ?? {};

  const route = createMockRootRouteFromStory(Story, routerParams.route);

  const router = createMockRouter({
    routeTree: route,
    initialPath: routerParams.path,
  });

  return <RouterProvider router={router}></RouterProvider>;
};
