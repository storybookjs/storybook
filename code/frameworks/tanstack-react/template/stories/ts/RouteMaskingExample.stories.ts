import type { Meta, StoryObj } from '@storybook/react';

import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { expect, within } from 'storybook/test';

import { GalleryPage, PhotoModal } from './RouteMaskingExample';

const rootRoute = createRootRoute({
  component: () => <div />,
});

const galleryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/gallery',
  component: GalleryPage,
});

const photoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/photos/$photoId',
  component: PhotoModal,
});

const routeTree = rootRoute.addChildren([galleryRoute, photoRoute]);

const maskedRouter = createRouter({
  routeTree,
  history: createMemoryHistory({ initialEntries: ['/gallery'] }),
  routeMasks: [{ from: '/gallery', to: '/photos/$photoId', params: { photoId: '1' } }],
});

const meta: Meta<typeof RouterProvider> = {
  title: 'Router Examples/Route Masking',
  render: () => null,
  parameters: {
    tanstack: {
      router: {
        instance: maskedRouter,
      },
    },
  },
};

export default meta;

export const MaskedGalleryRoute: StoryObj<typeof RouterProvider> = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole('heading', { name: /Photo Detail/i })).toBeInTheDocument();
    expect(canvas.getByText(/Viewing photo ID:/i)).toBeInTheDocument();
    expect(canvas.getByText('1')).toBeInTheDocument();
  },
};
