import React from 'react';
import type { Decorator, Loader } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { QueryParameters } from './types';

/**
 * Decorator that wraps each story in a `QueryClientProvider`.
 * The `QueryClient` is created by the loader so it's available in `beforeEach`.
 */
export const tanstackQueryDecorator: Decorator = (Story, ctx) => {
  const queryParams: QueryParameters = ctx.parameters.tanstack?.query ?? {};
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        ...queryParams.defaultOptions?.queries,
      },
      mutations: queryParams.defaultOptions?.mutations,
      dehydrate: queryParams.defaultOptions?.dehydrate,
      hydrate: queryParams.defaultOptions?.hydrate,
    },
  });

  React.useEffect(() => {
    return () => {
      queryClient.clear();
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Story />
    </QueryClientProvider>
  );
};
