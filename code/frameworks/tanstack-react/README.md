# @storybook/tanstack-react

Vite-based Storybook framework for TanStack Router + TanStack Query on React. Modeled after `@storybook/react-vite`, with extra preview helpers to provide router/query context. SPA-focused today (no TanStack Start SSR yet), but structured to grow (Solid support later).

## Quick start

```ts
// .storybook/main.ts
import type { StorybookConfig } from '@storybook/tanstack-react';

const config: StorybookConfig = {
  framework: '@storybook/tanstack-react',
};

export default config;
```

The preview decorator adds:
- `QueryClientProvider` (auto-created unless you provide one)
- Optional in-memory TanStack Router (or you can pass your own router/routeTree)

Enable routing + tune query defaults in `.storybook/preview.ts`:

```ts
export const parameters = {
  tanstack: {
    router: {
      enabled: true,
      initialEntries: ['/'],
    },
    queryClientConfig: {
      defaultOptions: {
        queries: { staleTime: 5 * 60 * 1000, retry: 0 },
      },
    },
  },
};
```

### Supplying your own router
```ts
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';

const root = createRootRoute({ component: () => null });
const index = createRoute({ getParentRoute: () => root, path: '/', component: () => <MyPage /> });
const router = createRouter({
  routeTree: root.addChildren([index]),
  history: createMemoryHistory({ initialEntries: ['/'] }),
});

export const parameters = {
  tanstack: {
    router: { instance: router },
  },
};
```

### Supplying your own QueryClient
```ts
import { QueryClient } from '@tanstack/react-query';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

export const parameters = {
  tanstack: {
    queryClient: qc,
  },
};
```

## Templates
Starter stories live in `template/cli/ts`:
- `QueryExample` shows basic `useQuery` setup
- `RouterExample` shows memory-based navigation with links/routes

## Sandboxes
Two sandboxes wire this framework for CI and examples:
- `code/sandbox/tanstack-router-default-ts`
- `code/sandbox/tanstack-start-default-ts`

## Testing & mocking tips
- Prefer passing a real router via `parameters.tanstack.router.instance` for navigation/params/guards/loader scenarios; otherwise set `router.enabled: true` for the built-in memory router.
- To drive auth/feature flags, supply `context` when you build your router, or expose it through your own `createTestRouter` helper in tests/stories.
- For React Query, set `queryClientConfig.defaultOptions.queries.retry = false` in tests, and seed data with `queryClient.setQueryData`.
- Stub devtools in tests if needed: `vi.mock('@tanstack/router-devtools', () => ({ TanStackRouterDevtools: () => null }));`
- File-based routing: generate `routeTree.gen.ts` and create a memory router with it in tests:\
  ```ts
  import { createRouter, createMemoryHistory, RouterProvider } from '@tanstack/react-router';
  import { routeTree } from '../routeTree.gen';
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: ['/'] }) });
  ```

## Compatibility
- React + Vite; TanStack Router/Query peer deps are required
- SPA-oriented; TanStack Start SSR/streaming not yet integrated
- Designed so a Solid variant can be added with similar APIs
