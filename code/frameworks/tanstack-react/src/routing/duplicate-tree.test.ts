import { describe, expect, it } from 'vitest';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';

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
});
