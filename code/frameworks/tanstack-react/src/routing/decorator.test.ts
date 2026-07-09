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

// Overrides are keyed by the ORIGINAL route id; the cloned leaf's `id` getter
// is init-backed and undefined at injection time, so the guard that respects
// a user's component override must resolve the original id instead.
describe('createStoryRouter with routeOverrides', () => {
  it('respects a component override on the story-bound route', async () => {
    const root = createRootRoute();
    const page = createRoute({ path: '/page', getParentRoute: () => root });
    root.addChildren([page]);
    const Marker = () => null;

    const router = createStoryRouter({
      Story: () => null,
      context: fakeContext(page, {
        routeOverrides: { '/page': { component: Marker } },
      }),
    });
    await router.load();

    const clonedPage = (router as any).routesById['/page'];
    expect(clonedPage.options.component).toBe(Marker);
  });
});
