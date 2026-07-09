import { describe, expect, it } from 'vitest';
import { createRootRoute, createRoute } from '@tanstack/react-router';

import { createStoryRouter } from './decorator.tsx';

// Regression coverage for mounting a story directly on a pathless layout
// nested under a pathful ancestor. Cloned routes aren't `init()`ed until
// `createRouter()` runs, so `leaf.fullPath` is unusable for path inference at
// the point `createStoryRouter` needs it — the mount path must come from
// walking the cloned parent chain's options instead (`mountPathFor`).

function fakeContext(route: unknown, extraRouterParams: Record<string, unknown> = {}) {
  return {
    id: 'test--direct-pathless',
    route: undefined,
    parameters: { tanstack: { router: { route, ...extraRouterParams } } },
  } as any;
}

describe('createStoryRouter with a pathless layout nested under a pathful ancestor', () => {
  it('mounts at the pathful ancestor URL and matches the layout', async () => {
    const root = createRootRoute();
    const products = createRoute({ path: '/products', getParentRoute: () => root });
    const layout = createRoute({ id: 'authed', getParentRoute: () => products });
    const settings = createRoute({ path: '/settings', getParentRoute: () => layout });
    layout.addChildren([settings]);
    products.addChildren([layout]);
    root.addChildren([products]);

    const router = createStoryRouter({
      Story: () => null,
      context: fakeContext(layout),
    });
    await router.load();

    const ids = router.state.matches.map((m: any) => m.routeId).join(',');
    expect(ids).toContain('authed');
    expect(router.state.location.pathname).toBe('/products');
  });

  it('mounts a pathless layout directly under root at "/"', async () => {
    const root = createRootRoute();
    const layout = createRoute({ id: 'authed', getParentRoute: () => root });
    const settings = createRoute({ path: '/settings', getParentRoute: () => layout });
    layout.addChildren([settings]);
    root.addChildren([layout]);

    const router = createStoryRouter({
      Story: () => null,
      context: fakeContext(layout),
    });
    await router.load();

    const ids = router.state.matches.map((m: any) => m.routeId).join(',');
    expect(ids).toContain('authed');
    expect(router.state.location.pathname).toBe('/');
  });
});

// A pathless layout that already has an index child (`path: '/'` — the common
// `_authed/index.tsx` shape) must reuse that child instead of attaching a
// synthetic sibling: both would derive the same generated id and
// `createRouter` throws `Duplicate routes found`.
describe('createStoryRouter with a pathless layout that already has an index child', () => {
  function buildTree() {
    const root = createRootRoute();
    const products = createRoute({ path: '/products', getParentRoute: () => root });
    const layout = createRoute({ id: 'authed', getParentRoute: () => products });
    const index = createRoute({ path: '/', getParentRoute: () => layout });
    const settings = createRoute({ path: '/settings', getParentRoute: () => layout });
    layout.addChildren([index, settings]);
    products.addChildren([layout]);
    root.addChildren([products]);
    return layout;
  }

  it('reuses the existing index child (no path param)', async () => {
    const router = createStoryRouter({
      Story: () => null,
      context: fakeContext(buildTree()),
    });
    await router.load();

    const ids = router.state.matches.map((m: any) => m.routeId).join(',');
    expect(ids).toContain('authed');
    expect(router.state.location.pathname).toBe('/products');
  });

  it('reuses the existing index child (explicit path param at the mount URL)', async () => {
    const router = createStoryRouter({
      Story: () => null,
      context: fakeContext(buildTree(), { path: '/products' }),
    });
    await router.load();

    const ids = router.state.matches.map((m: any) => m.routeId).join(',');
    expect(ids).toContain('authed');
    expect(router.state.location.pathname).toBe('/products');
  });
});

// Explicit `path` selection previously compared init-backed `fullPath`
// getters (always undefined on clones), so it silently fell through to the
// bound route or the root's first child.
describe('createStoryRouter leaf selection by path', () => {
  it('selects the route matching an explicit path when only the routeTree is bound', async () => {
    const root = createRootRoute();
    const home = createRoute({ path: '/', getParentRoute: () => root });
    const about = createRoute({ path: '/about', getParentRoute: () => root });
    root.addChildren([home, about]);

    const router = createStoryRouter({
      Story: () => null,
      context: fakeContext(root, { path: '/about' }),
    });
    await router.load();

    expect(router.state.location.pathname).toBe('/about');
    expect((router as any).routesById['/about'].options.component).toBeDefined();
    expect((router as any).routesById['/'].options.component).toBeUndefined();
  });

  it('selects a param route by interpolating the provided params', async () => {
    const root = createRootRoute();
    const list = createRoute({ path: '/users', getParentRoute: () => root });
    const detail = createRoute({ path: '/users/$userId', getParentRoute: () => root });
    root.addChildren([list, detail]);

    const router = createStoryRouter({
      Story: () => null,
      context: fakeContext(root, { path: '/users/42', params: { userId: '42' } }),
    });
    await router.load();

    expect(router.state.location.pathname).toBe('/users/42');
    expect((router as any).routesById['/users/$userId'].options.component).toBeDefined();
    expect((router as any).routesById['/users'].options.component).toBeUndefined();
  });

  it('prefers the bound route when its mount path matches the explicit path', async () => {
    const root = createRootRoute();
    const post = createRoute({ path: '/posts/$postId', getParentRoute: () => root });
    const postIndex = createRoute({ path: '/', getParentRoute: () => post });
    post.addChildren([postIndex]);
    root.addChildren([post]);

    const router = createStoryRouter({
      Story: () => null,
      context: fakeContext(postIndex, { path: '/posts/$postId' }),
    });
    await router.load();

    expect((router as any).routesById['/posts/$postId/'].options.component).toBeDefined();
    expect((router as any).routesById['/posts/$postId'].options.component).toBeUndefined();
  });
});
