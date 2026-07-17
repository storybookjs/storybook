import { describe, expect, it, vi } from 'vitest';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { fn } from 'storybook/test';

import { createFileRoute } from '../export-mocks/react-router.ts';
import { duplicateRouteTree } from './duplicate-tree.ts';

async function matchedRouteIds(routeTree: any, path: string): Promise<Array<string>> {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  await router.load();
  return router.state.matches.map((match) => match.routeId);
}

/** Builds root -> `/_authed` (pathless layout) -> `/_authed/dashboard`. */
function buildAuthedTree(layoutOptions: Record<string, unknown> = {}) {
  const root = createRootRoute();
  const layout = createFileRoute('/_authed')({
    getParentRoute: () => root,
    ...layoutOptions,
  }) as any;
  const dashboard = createFileRoute('/_authed/dashboard')({
    getParentRoute: () => layout,
  }) as any;
  layout.addChildren([dashboard]);
  root.addChildren([layout]);
  return { root, layout, dashboard };
}

describe('duplicateRouteTree root options', () => {
  it('copies root behavior but never the document shell', () => {
    const RootComponent = () => null;
    const rootBeforeLoad = vi.fn();
    const Shell = ({ children }: { children: unknown }) => children;
    const root = createRootRoute({
      component: RootComponent,
      beforeLoad: rootBeforeLoad,
      shellComponent: Shell,
    } as any);

    const { root: cloned } = duplicateRouteTree(root as any);

    expect((cloned as any).options.component).toBe(RootComponent);
    expect((cloned as any).options.beforeLoad).toBe(rootBeforeLoad);
    expect((cloned as any).options.shellComponent).toBeUndefined();
  });
});

describe('duplicateRouteTree with pathless layout routes', () => {
  it('preserves a code-based pathless layout (explicit id, no path)', async () => {
    const root = createRootRoute();
    const layout = createRoute({ id: 'authed', getParentRoute: () => root });
    const dashboard = createRoute({ path: '/dashboard', getParentRoute: () => layout });
    layout.addChildren([dashboard]);
    root.addChildren([layout]);

    const { root: cloned } = duplicateRouteTree(root as any);
    const ids = await matchedRouteIds(cloned, '/dashboard');

    expect(ids.join(',')).toContain('dashboard');
  });

  it('preserves a file-based pathless layout from createFileRoute', async () => {
    const { root } = buildAuthedTree();

    const { root: cloned } = duplicateRouteTree(root as any);
    const ids = await matchedRouteIds(cloned, '/dashboard');

    expect(ids.join(',')).toContain('dashboard');
  });

  it('does not let a pathless layout shadow a sibling index route', async () => {
    const { root, layout } = buildAuthedTree();
    const index = createRoute({ path: '/', getParentRoute: () => root });
    root.addChildren([index, layout]);

    const { root: cloned } = duplicateRouteTree(root as any);

    expect((await matchedRouteIds(cloned, '/dashboard')).join(',')).toContain('dashboard');
    expect(await matchedRouteIds(cloned, '/')).toContain('/');
  });

  it('lets routeOverrides give a pathless layout a real path without crashing', async () => {
    const { root } = buildAuthedTree();

    const { root: cloned } = duplicateRouteTree(root as any, {
      overrides: { '/_authed': { path: '/authed' } } as any,
    });

    expect((await matchedRouteIds(cloned, '/authed/dashboard')).join(',')).toContain('dashboard');
  });

  it('routes through a pathless layout nested under a pathful segment', async () => {
    // Mirror routeTree.gen output: nested routes are re-updated with
    // parent-relative ids/paths; the pathless layout keeps id only.
    const root = createRootRoute();
    const posts = createFileRoute('/posts')({ getParentRoute: () => root }) as any;
    const layout = (
      createFileRoute('/posts/_layout')({ getParentRoute: () => posts }) as any
    ).update({ id: '/_layout', getParentRoute: () => posts } as any);
    const settings = (
      createFileRoute('/posts/_layout/settings')({ getParentRoute: () => layout }) as any
    ).update({ id: '/settings', path: '/settings', getParentRoute: () => layout } as any);
    layout.addChildren([settings]);
    posts.addChildren([layout]);
    root.addChildren([posts]);

    const { root: cloned } = duplicateRouteTree(root as any);

    expect((await matchedRouteIds(cloned, '/posts/settings')).join(',')).toContain('settings');
  });

  it('preserves composed ids through cloning so strict from-lookups match', async () => {
    // Real routeTree.gen output for `posts/_archive/archived.tsx`: the nested
    // pathless layout keeps its id AND carries the pathful prefix as `path`.
    // Strict hooks (`Route.useLoaderData()`) resolve matches by the original
    // composed id, so clones must compose to identical ids.
    const root = createRootRoute();
    const layout = (
      createFileRoute('/posts/_archive')({ getParentRoute: () => root }) as any
    ).update({ id: '/posts/_archive', path: '/posts', getParentRoute: () => root } as any);
    const archived = (
      createFileRoute('/posts/_archive/archived')({ getParentRoute: () => layout }) as any
    ).update({ id: '/archived', path: '/archived', getParentRoute: () => layout } as any);
    layout.addChildren([archived]);
    root.addChildren([layout]);

    const { root: cloned } = duplicateRouteTree(root as any);
    const ids = await matchedRouteIds(cloned, '/posts/archived');

    expect(ids).toContain('/posts/_archive');
    expect(ids).toContain('/posts/_archive/archived');
  });

  it('applies an override that sets its own id on a pathful route', async () => {
    // An override may re-key a route by supplying `id`. That id must not reach
    // `createRoute` alongside the route's `path` (TanStack rejects id+path);
    // it is applied via `.update()` instead, and wins over the original id.
    const root = createRootRoute();
    const archive = (createRoute({ path: '/posts', getParentRoute: () => root }) as any).update({
      id: '/posts/_archive',
      path: '/posts',
      getParentRoute: () => root,
    });
    root.addChildren([archive]);

    const { root: cloned } = duplicateRouteTree(root as any, {
      overrides: { '/posts/_archive': { id: '/custom' } } as any,
    });
    const ids = await matchedRouteIds(cloned, '/posts');

    expect(ids).toContain('/custom');
    expect(ids).not.toContain('/posts/_archive');
  });
});

describe('duplicateRouteTree matrix (code-based and file-based trees)', () => {
  it('clones nested pathful layouts with an index child (code-based)', async () => {
    const root = createRootRoute();
    const users = createRoute({ path: '/users', getParentRoute: () => root });
    const list = createRoute({ path: '/', getParentRoute: () => users });
    const detail = createRoute({ path: '/$userId', getParentRoute: () => users });
    users.addChildren([list, detail]);
    root.addChildren([users]);

    const { root: cloned } = duplicateRouteTree(root as any);

    expect((await matchedRouteIds(cloned, '/users')).join(',')).toContain('/users');
    expect((await matchedRouteIds(cloned, '/users/42')).join(',')).toContain('$userId');
  });

  it('exposes path params through the cloned tree', async () => {
    const root = createRootRoute();
    const detail = createRoute({ path: '/users/$userId', getParentRoute: () => root });
    root.addChildren([detail]);

    const { root: cloned } = duplicateRouteTree(root as any);
    const router = createRouter({
      routeTree: cloned,
      history: createMemoryHistory({ initialEntries: ['/users/42'] }),
    });
    await router.load();

    const match = router.state.matches.find((m) => m.routeId.includes('$userId'));
    expect(match?.params).toEqual({ userId: '42' });
  });

  it('clones file-based trees mixing group, layout, and param segments', async () => {
    // Mirror what routeTree.gen.ts emits: `createFileRoute` sets absolute
    // normalized paths, then the generated tree rewrites nested routes to
    // parent-relative ids/paths via `.update()`.
    const root = createRootRoute();
    const group = createFileRoute('/(app)')({ getParentRoute: () => root }) as any;
    const posts = (createFileRoute('/(app)/posts')({ getParentRoute: () => group }) as any).update({
      id: '/posts',
      path: '/posts',
      getParentRoute: () => group,
    } as any);
    const post = (
      createFileRoute('/(app)/posts/$postId')({ getParentRoute: () => posts }) as any
    ).update({
      id: '/$postId',
      path: '/$postId',
      getParentRoute: () => posts,
    } as any);
    posts.addChildren([post]);
    group.addChildren([posts]);
    root.addChildren([group]);

    const { root: cloned } = duplicateRouteTree(root as any);

    expect((await matchedRouteIds(cloned, '/posts/7')).join(',')).toContain('$postId');
  });

  it('applies routeOverrides to cloned pathless routes by original id', async () => {
    const original = fn();
    const override = fn();
    const { root } = buildAuthedTree({ beforeLoad: original });

    const { root: cloned } = duplicateRouteTree(root as any, {
      overrides: {
        '/_authed': { beforeLoad: override },
      } as any,
    });
    await matchedRouteIds(cloned, '/dashboard');

    expect(override).toHaveBeenCalled();
    expect(original).not.toHaveBeenCalled();
  });
});
