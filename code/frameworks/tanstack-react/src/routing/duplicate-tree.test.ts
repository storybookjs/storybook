import { describe, expect, it } from 'vitest';
import { createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';

import { duplicateRouteTree } from './duplicate-tree.ts';

describe('duplicateRouteTree', () => {
  it('preserves pathless layout routes as id-only routes', async () => {
    const root = createRootRoute();
    const authed = createRoute({
      id: '/_authed',
      getParentRoute: () => root,
      component: () => null,
    });
    const race = createRoute({
      path: 'races/$racePublicId/$raceSlug',
      getParentRoute: () => authed,
      component: () => null,
    });
    const test = createRoute({
      path: 'test',
      getParentRoute: () => race,
      component: () => null,
    });

    root.addChildren([authed.addChildren([race.addChildren([test])])]);

    const { root: duplicatedRoot, byId } = duplicateRouteTree(root);
    const clonedAuthed = byId.get(authed.id) as any;
    const clonedRace = byId.get(race.id) as any;
    const clonedTest = byId.get(test.id) as any;

    expect(clonedAuthed.options.id).toBe('/_authed');
    expect(clonedAuthed.options.path).toBeUndefined();

    const router = createRouter({
      routeTree: duplicatedRoot,
      history: createMemoryHistory({
        initialEntries: ['/races/dragonborn/dragonborn/test'],
      }),
    });
    await router.load();

    expect(router.state.matches.map((match) => match.routeId)).toEqual([
      duplicatedRoot.id,
      clonedAuthed.id,
      clonedRace.id,
      clonedTest.id,
    ]);
  });
});