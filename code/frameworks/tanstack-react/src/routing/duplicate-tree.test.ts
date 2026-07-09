import { describe, expect, it } from 'vitest';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';

import { duplicateRouteTree } from './duplicate-tree.ts';

async function matchedRouteIds(routeTree: any, path: string): Promise<Array<string>> {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  await router.load();
  return router.state.matches.map((match) => match.routeId);
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
});
