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

## Routes in Storybook

The router can run in three modes:

- `story` (default): wraps the story element in a minimal router with a configurable `storyPath`.
- `routeTree`: builds a router from your route tree (file-based or code-based).
- `instance`: uses a router instance you supply.

Common router options:

- `storyPath` (default `/`), `initialEntries`, `initialIndex`
- `defaultSearch`, `defaultParams` (prefill location when creating the router)
- `context` (passed to `createRouter`, e.g. for `createRootRouteWithContext`)
- `createRouter` (advanced factory override), `history` (bring your own)

### File-based / generated route tree

```ts
// .storybook/preview.ts
import { routeTree } from '../src/routeTree.gen';

export const parameters = {
  tanstack: {
    router: {
      mode: 'routeTree',
      routeTree,
      initialEntries: ['/posts/123'],
      context: { featureFlag: true },
    },
  },
};
```

### Code-based route tree with helper

```ts
// stories/router.setup.ts
import { createStoryMemoryRouter } from '@storybook/tanstack-react';
import { createRootRoute, createRoute } from '@tanstack/react-router';
import { RouterLayout, RouterHome, RouterAbout } from './RouterExample';

const root = createRootRoute({ component: RouterLayout });
const home = createRoute({ getParentRoute: () => root, path: '/', component: RouterHome });
const about = createRoute({ getParentRoute: () => root, path: 'about', component: RouterAbout });

export const router = createStoryMemoryRouter({
  routeTree: root.addChildren([home, about]),
  initialEntries: ['/'],
});
```

```ts
// stories/RouterExample.stories.ts
import type { Meta, StoryObj } from '@storybook/react';
import { router } from './router.setup';

const meta: Meta = {
  render: () => null,
  parameters: { tanstack: { router: { instance: router } } },
};

export default meta;
export const WithMemoryRouter: StoryObj = {};
```

### Layouts, nested routes, and params

- Use `initialEntries` to land on nested paths (e.g., `/app/settings/profile`).
- Use dynamic segments by setting `initialEntries: ['/posts/42']` and reading params via `useMatch({ from: '/posts/$postId' })`.
- Supply `context` when your routes use `createRootRouteWithContext`.

> File-based routing note: Storybook filters TanStack Start Vite plugins for compatibility. Generate your `routeTree.gen.ts` during your app build/dev and import it into Storybook.

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
- File-based routing: generate `routeTree.gen.ts` and create a memory router with it in tests:

  ```ts
  import { createRouter, createMemoryHistory, RouterProvider } from '@tanstack/react-router';
  import { routeTree } from '../routeTree.gen';
  
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: ['/'] }) });
  ```

## Loader Mocking

Mock route loaders to test different data states. Use `createRouteTree` for fresh instances and `mockLoaders` to inject test data:

```tsx
Story.parameters = {
  tanstack: {
    router: {
      createRouteTree: () => routeTree,
      mockLoaders: {
        '/posts/$id': async () => ({ post: { id: '1', title: 'Mocked Post' } }),
      },
    },
  },
};
```

For pending states, use `forcePending: true`:

```tsx
Story.parameters = {
  tanstack: {
    router: {
      createRouteTree: () => routeTree,
      forcePending: true,
    },
  },
};
```

For error scenarios:

```tsx
Story.parameters = {
  tanstack: {
    router: {
      createRouteTree: () => routeTree,
      forceError: new Error('Network failed'),
    },
  },
};
```

## Guard Mocking

Mock `beforeLoad` guards:

```tsx
Story.parameters = {
  tanstack: {
    router: {
      mockBeforeLoad: {
        '/admin': async () => ({ user: { role: 'admin' } }),
      },
    },
  },
};
```

Bypass all guards:

```tsx
Story.parameters = {
  tanstack: {
    router: {
      bypassGuards: true,
    },
  },
};
```

## Forcing States

Force not-found state:

```tsx
Story.parameters = {
  tanstack: {
    router: {
      forceNotFound: true,
      defaultNotFoundComponent: () => <div>404</div>,
    },
  },
};
```

**Note:** If your route tree contains a wildcard (`*`) route, the sentinel path may be matched by it instead of triggering not-found.

## Custom History

Use hash-based routing:

```tsx
import { createStoryMemoryRouter } from '@storybook/tanstack-react';
import { createHashHistory } from '@tanstack/react-router';

const router = createStoryMemoryRouter({
  routeTree,
  history: createHashHistory(),
});

Story.parameters = {
  tanstack: {
    router: {
      instance: router,
    },
  },
};
```

## Programmatic Navigation in Play Functions

Use `getRouter()` to navigate:

```tsx
import { getRouter } from '@storybook/tanstack-react';

Story.play = async () => {
  const router = getRouter();
  if (router) {
    await router.navigate({ to: '/posts' });
  }
};
```

For multiple stories, use `getRouterForStory(id)`.

## Type-Safe Search Params

Use `createStorySearchParams` and `InferRouteSearch`:

```tsx
import { createStorySearchParams, type InferRouteSearch } from '@storybook/tanstack-react';

type PostsSearch = InferRouteSearch<typeof PostsRoute>;

Story.parameters = {
  tanstack: {
    router: {
      defaultSearch: createStorySearchParams<typeof PostsRoute>({
        page: 1,
        sort: 'date',
      }),
    },
  },
};
```

## Pathless Layout Routes

Use `mode: 'routeTree'` with pathless layout (`id: '_layout'`):

```tsx
Story.parameters = {
  tanstack: {
    router: {
      mode: 'routeTree',
      routeTree,
      initialEntries: ['/child-path'],
    },
  },
};
```

## Route Masking

Use `routeMasks` with `createRouter`:

```tsx
import { createRouter, createMemoryHistory } from '@tanstack/react-router';

const router = createRouter({
  routeTree,
  history: createMemoryHistory({ initialEntries: ['/gallery'] }),
  routeMasks: [{ from: '/gallery', to: '/photos/$id', params: { id: '1' } }],
});

Story.parameters = {
  tanstack: {
    router: {
      instance: router,
    },
  },
};
```

## Compatibility

- React + Vite; TanStack Router/Query peer deps are required
- SPA-oriented; TanStack Start SSR/streaming not yet integrated
- Designed so a Solid variant can be added with similar APIs
