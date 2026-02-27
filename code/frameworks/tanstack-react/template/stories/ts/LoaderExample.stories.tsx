import type { Meta, StoryObj } from '@storybook/react';

import { RouterProvider, createRootRoute, createRoute } from '@tanstack/react-router';
import { expect, within } from 'storybook/test';

import { PostDetail, PostErrorBanner, PostLoadingSpinner, type Post } from './LoaderExample';

const fetchPost = async (postId: string): Promise<Post> => {
  const response = await fetch(`https://jsonplaceholder.typicode.com/posts/${postId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch post ${postId}`);
  }
  return response.json();
};

const createPostRouteTree = () => {
  const rootRoute = createRootRoute({
    component: () => <div />,
  });

  const postRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/posts/$postId',
    component: PostDetail,
    loader: ({ params }) => fetchPost(params.postId),
  });

  return rootRoute.addChildren([postRoute]);
};

const meta: Meta<typeof RouterProvider> = {
  title: 'Router Examples/Loaders',
  render: () => null,
  parameters: {
    tanstack: {
      router: {
        mode: 'routeTree' as const,
        createRouteTree: createPostRouteTree,
        initialEntries: ['/posts/42'],
      },
    },
  },
};

export default meta;

export const WithMockLoader: StoryObj<typeof RouterProvider> = {
  parameters: {
    tanstack: {
      router: {
        mode: 'routeTree',
        createRouteTree: createPostRouteTree,
        initialEntries: ['/posts/42'],
        mockLoaders: {
          '/posts/$postId': () => ({
            id: '42',
            title: 'Mock Post Title',
            body: 'This is a mocked post body with test content.',
          }),
        },
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const title = await canvas.findByText('Mock Post Title');
    expect(title).toBeInTheDocument();
    expect(await canvas.findByText(/This is a mocked post body/)).toBeInTheDocument();
  },
};

export const Pending: StoryObj<typeof RouterProvider> = {
  parameters: {
    tanstack: {
      router: {
        mode: 'routeTree',
        createRouteTree: createPostRouteTree,
        initialEntries: ['/posts/42'],
        forcePending: true,
        defaultPendingComponent: PostLoadingSpinner,
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const spinner = await canvas.findByRole('status');
    expect(spinner).toBeInTheDocument();
    expect(canvas.getByText(/Loading post/)).toBeInTheDocument();
  },
};

export const ErrorState: StoryObj<typeof RouterProvider> = {
  parameters: {
    tanstack: {
      router: {
        mode: 'routeTree',
        createRouteTree: createPostRouteTree,
        initialEntries: ['/posts/42'],
        forceError: new Error('Failed to load post'),
        defaultErrorComponent: PostErrorBanner,
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = await canvas.findByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(canvas.getByText(/Failed to load post/)).toBeInTheDocument();
  },
};
