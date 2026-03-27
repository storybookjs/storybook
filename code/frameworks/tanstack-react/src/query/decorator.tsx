import React from 'react';
import type { Decorator, Loader } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { QueryParameters } from './types';

let currentQueryClient: QueryClient | null = null;

/**
 * Returns the current story's `QueryClient` instance.
 *
 * Available in `beforeEach`, `play`, and inside decorators/components.
 *
 * ```ts
 * import { getQueryClient } from '@storybook/tanstack-react';
 *
 * export const WithUsers = {
 *   async beforeEach() {
 *     getQueryClient().setQueryData(['users'], [{ id: 1, name: 'Alice' }]);
 *   },
 * };
 * ```
 */
export function getQueryClient(): QueryClient {
  if (!currentQueryClient) {
    throw new Error(
      'QueryClient is not available. Make sure the TanStack Query decorator is active.'
    );
  }
  return currentQueryClient;
}

/**
 * Loader that creates a fresh `QueryClient` per story render.
 * Runs before `beforeEach`, so the client is accessible via `getQueryClient()`.
 */
export const tanstackQueryLoader: Loader = ({ parameters }) => {
  const queryParams: QueryParameters = parameters.tanstack?.query ?? {};

  currentQueryClient = new QueryClient({
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
};

/**
 * Decorator that wraps each story in a `QueryClientProvider`.
 * The `QueryClient` is created by the loader so it's available in `beforeEach`.
 */
export const tanstackQueryDecorator: Decorator = (Story) => {
  const queryClient = getQueryClient();

  React.useEffect(() => {
    return () => {
      queryClient.clear();
      currentQueryClient = null;
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      z
      <Story />
    </QueryClientProvider>
  );
};
